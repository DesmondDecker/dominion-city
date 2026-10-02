// Quota-aware provider load balancer: Resend → Brevo → SendGrid → Mailgun,
// in priority order. This is NOT simultaneous sending (that would mean
// duplicate emails) — it sends through exactly one provider per email.
//
// The switch happens for two different reasons, handled differently:
//  - Out of quota (a 429 from the provider, or our own tracked count
//    already at the configured daily limit): skip this provider for the
//    rest of the day and move to the next one. This is the "load
//    balancing" behavior — routing around exhausted capacity.
//  - Any other failure (bad key, provider outage, malformed request):
//    also move to the next provider, but don't mark it exhausted —
//    it's not a quota problem, so it should be tried again next time.
//
// Daily counts live in MongoDB (EmailProviderUsage), not in-memory,
// because a serverless function has no memory between invocations.

const EmailProviderUsage = require('../models/EmailProviderUsage');

class RateLimitError extends Error {}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-09-16"
}

async function viaResend({ to, subject, html, from }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (res.status === 429) throw new RateLimitError('Resend rate limited');
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

async function viaBrevo({ to, subject, html, from }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: { email: from }, to: [{ email: to }], subject, htmlContent: html }),
  });
  if (res.status === 429) throw new RateLimitError('Brevo rate limited');
  if (!res.ok) throw new Error(`Brevo failed: ${res.status} ${await res.text()}`);
}

async function viaSendGrid({ to, subject, html, from }) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (res.status === 429) throw new RateLimitError('SendGrid rate limited');
  if (!res.ok) throw new Error(`SendGrid failed: ${res.status} ${await res.text()}`);
}

async function viaMailgun({ to, subject, html, from }) {
  const domain = process.env.MAILGUN_DOMAIN;
  const auth = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64');
  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ from, to, subject, html }),
  });
  if (res.status === 429) throw new RateLimitError('Mailgun rate limited');
  if (!res.ok) throw new Error(`Mailgun failed: ${res.status} ${await res.text()}`);
}

// Default daily caps, used only if the matching env var isn't set.
// These are deliberately conservative placeholders, not a claim about
// any provider's actual current free-tier limit — check each
// provider's own dashboard and set RESEND_DAILY_LIMIT etc. to match
// your real plan.
const PROVIDERS = [
  { name: 'resend', envKey: 'RESEND_API_KEY', limitEnvKey: 'RESEND_DAILY_LIMIT', defaultLimit: 100, send: viaResend },
  { name: 'brevo', envKey: 'BREVO_API_KEY', limitEnvKey: 'BREVO_DAILY_LIMIT', defaultLimit: 300, send: viaBrevo },
  { name: 'sendgrid', envKey: 'SENDGRID_API_KEY', limitEnvKey: 'SENDGRID_DAILY_LIMIT', defaultLimit: 100, send: viaSendGrid },
  { name: 'mailgun', envKey: 'MAILGUN_API_KEY', limitEnvKey: 'MAILGUN_DAILY_LIMIT', defaultLimit: 100, send: viaMailgun },
];

async function getUsage(provider, dateKey) {
  const doc = await EmailProviderUsage.findOne({ provider, dateKey });
  return doc ? doc.count : 0;
}

async function incrementUsage(provider, dateKey, by = 1) {
  await EmailProviderUsage.findOneAndUpdate(
    { provider, dateKey },
    { $inc: { count: by } },
    { upsert: true }
  );
}

// Marks a provider as exhausted for the rest of the day by jumping its
// counter straight to the limit, so subsequent emails today skip it
// without needing to hit the provider (and get rate-limited) again.
async function markExhausted(provider, dateKey, limit) {
  await EmailProviderUsage.findOneAndUpdate(
    { provider, dateKey },
    { $set: { count: limit } },
    { upsert: true }
  );
}

async function sendEmail({ to, subject, html }) {
  const from = process.env.EMAIL_FROM || 'no-reply@dominioncitychurch.org';
  const dateKey = todayKey();
  const configured = PROVIDERS.filter((p) => process.env[p.envKey]);

  if (configured.length === 0) {
    throw new Error('No email provider configured — set at least one of RESEND_API_KEY, BREVO_API_KEY, SENDGRID_API_KEY, MAILGUN_API_KEY');
  }

  const attempts = [];
  for (const provider of configured) {
    const limit = Number(process.env[provider.limitEnvKey]) || provider.defaultLimit;
    const used = await getUsage(provider.name, dateKey);

    if (used >= limit) {
      attempts.push(`${provider.name}: skipped, out of quota (${used}/${limit} today)`);
      continue; // load-balance around this provider for the rest of the day
    }

    try {
      await provider.send({ to, subject, html, from });
      await incrementUsage(provider.name, dateKey);
      return { sentVia: provider.name, usedToday: used + 1, limit };
    } catch (err) {
      if (err instanceof RateLimitError) {
        // The provider itself says we're out of quota, even though our
        // own count didn't think so yet (e.g. limit changed, or usage
        // from outside this app) — trust the provider and stop using
        // it for the rest of today.
        await markExhausted(provider.name, dateKey, limit);
        attempts.push(`${provider.name}: rate limited by provider, marked exhausted for today`);
      } else {
        attempts.push(`${provider.name}: ${err.message}`);
      }
      // either way, fall through to the next provider
    }
  }

  throw new Error(`All configured email providers failed or are out of quota — ${attempts.join(' | ')}`);
}

module.exports = { sendEmail };
