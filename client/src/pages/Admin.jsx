import { useEffect, useState } from 'react';
import { loadInvites, sendInvite } from '../lib/staffInvites';
import { loadAdminStats } from '../lib/adminStats';
import { ensureChurchId } from '../lib/church';
import BranchPicker from '../components/BranchPicker';
import MiniBarChart from '../components/MiniBarChart';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

const ROLES = [
  ['national_admin', 'National admin'],
  ['territory_admin', 'Territory admin'],
  ['branch_admin', 'Branch admin'],
  ['fellowship_leader', 'Fellowship leader'],
  ['department_head', 'Department head'],
  ['campus_staff', 'Campus staff'],
  ['checkin_volunteer', 'Check-in volunteer'],
];

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);
  const [invites, setInvites] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', role: 'campus_staff', branch: '' });
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const s = await loadAdminStats();
    setStats(s);
    setStatsError(!s);
    setInvites(await loadInvites());
  }

  async function handleInvite() {
    const church = await ensureChurchId();
    if (!navigator.onLine) {
      setStatus({ ok: false, message: "You're offline — invites need a connection to send. Try again once you're back online." });
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const result = await sendInvite({
        ...(church ? { church } : {}),
        name: form.name,
        email: form.email,
        role: form.role,
        branches: form.branch ? [form.branch] : [],
      });
      if (result.emailStatus.startsWith('sent_via_')) {
        setStatus({ ok: true, message: `Invite sent (via ${result.emailStatus.replace('sent_via_', '')}).` });
      } else {
        setStatus({
          ok: false,
          message: `Invite created, but the email couldn't be sent. Share this link directly: ${result.acceptUrl}`,
        });
      }
      setForm({ name: '', email: '', role: 'campus_staff', branch: '' });
      refresh();
    } catch (err) {
      setStatus({ ok: false, message: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Admin</h1>
      <p style={{ color: 'var(--ink-500)', marginTop: 6, marginBottom: 24 }}>
        {stats?.scope === 'national' ? 'Organization-wide view' : 'Your scope'} · as of{' '}
        {stats ? new Date(stats.asOf).toLocaleTimeString() : '—'}
      </p>

      {!navigator.onLine && (
        <p style={{ color: 'var(--warn-text)', fontSize: 13, marginBottom: 16 }}>
          Analytics need a connection — this page doesn't work offline like the rest of the app.
        </p>
      )}
      {statsError && navigator.onLine && (
        <p style={{ color: 'var(--warn-text)', fontSize: 13, marginBottom: 16 }}>Couldn't load analytics.</p>
      )}

      {stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 20 }}>
            <StatCard label="Branches" value={stats.branchCount} />
            <StatCard label="Territories" value={stats.territoryCount} />
            <StatCard label="Members" value={stats.members.total} />
            <StatCard label="At-risk" value={stats.members.byStatus['at-risk'] || 0} tone="warn" />
            <StatCard label="Checked in today" value={stats.checkins.today} />
            <StatCard label="Departments" value={stats.departmentCount} />
          </div>

          <div className="responsive-grid-2" style={{ marginBottom: 16 }}>
            <div className="card">
              <h2 style={{ marginBottom: 14 }}>Check-ins, last 7 days</h2>
              {stats.checkins.last7Days.length > 0 ? (
                <MiniBarChart data={stats.checkins.last7Days} labelKey="date" valueKey="count" />
              ) : (
                <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No check-ins recorded yet.</p>
              )}
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 14 }}>Members by status</h2>
              {Object.entries(stats.members.byStatus).map(([key, count]) => (
                <BarRow key={key} label={key} count={count} total={stats.members.total} />
              ))}
              {stats.members.total === 0 && <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No members yet.</p>}
            </div>
          </div>

          <div className="responsive-grid-3" style={{ marginBottom: 24 }}>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>Events</h2>
              <p style={{ fontSize: 13, color: 'var(--ink-500)' }}>Upcoming</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--navy-900)' }}>{stats.events.upcoming}</p>
              <p style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 10 }}>Total RSVPs</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--navy-900)' }}>{stats.events.totalRsvps}</p>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 10 }}>Welfare cases</h2>
              {Object.entries(stats.welfare.byStatus).length === 0 && (
                <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>None on record.</p>
              )}
              {Object.entries(stats.welfare.byStatus).map(([key, count]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 10 }}>Staff by role</h2>
              {Object.entries(stats.staff.byRole).map(([key, count]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                  <span>{count}</span>
                </div>
              ))}
              <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 8 }}>{stats.staff.pendingInvites} invite(s) pending</p>
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ maxWidth: 520, marginBottom: 24 }}>
        <h2 style={{ marginBottom: 14 }}>Invite staff</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <input style={inputStyle} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input style={inputStyle} placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <BranchPicker value={form.branch} onChange={(branch) => setForm({ ...form, branch })} />
        </div>
        <button className="btn btn-primary" onClick={handleInvite} disabled={!form.name || !form.email || sending}>
          {sending ? 'Sending…' : 'Send invite'}
        </button>
        {status && (
          <p style={{ marginTop: 12, fontSize: 13, color: status.ok ? 'var(--good-text)' : 'var(--warn-text)' }}>
            {status.message}
          </p>
        )}
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <h2 style={{ marginBottom: 14 }}>Pending invites</h2>
        {invites.length === 0 && <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>None pending.</p>}
        {invites.map((inv) => (
          <div key={inv._id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0', fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{inv.name} · {inv.email}</span>
              <span className="badge new" style={{ textTransform: 'capitalize' }}>{inv.role.replace('_', ' ')}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
              Expires {new Date(inv.expiresAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className="card">
      <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>{label}</p>
      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 26,
          marginTop: 4,
          color: tone === 'warn' && value > 0 ? 'var(--warn-text)' : 'var(--navy-900)',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function BarRow({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ textTransform: 'capitalize' }}>{label}</span>
        <span style={{ color: 'var(--ink-500)' }}>{count}</span>
      </div>
      <div style={{ height: 6, background: 'var(--blue-100)', borderRadius: 4 }}>
        <div style={{ height: 6, width: `${pct}%`, background: 'var(--blue-600)', borderRadius: 4 }} />
      </div>
    </div>
  );
}
