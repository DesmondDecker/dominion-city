import { useEffect, useState } from 'react';
import { loadChurchId } from '../lib/church';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Someone landing on /login before any admin account exists should
    // land on setup instead, not see a login form with nothing to log
    // into. Fails silently if offline — they'll just see the normal
    // login form and get a normal "invalid credentials" error.
    fetch('/api/bootstrap')
      .then((res) => res.json())
      .then((data) => {
        if (data.needsBootstrap) window.location.href = '/setup';
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError('Those details don\u2019t match an account.');
        return;
      }
      const data = await res.json();
      localStorage.setItem('token', data.token);
      // Pre-warm the church ID cache so every page works immediately
      // after login without needing to visit Branches first.
      await loadChurchId().catch(() => {});
      window.location.href = '/';
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--navy-900)',
      }}
    >
      <form onSubmit={handleSubmit} className="card" style={{ width: 360, background: 'var(--white)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <span
            aria-hidden="true"
            style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid var(--navy-900)' }}
          />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--navy-900)' }}>
            Dominion City
          </span>
        </div>

        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 12px',
            border: '1px solid var(--line)',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        />

        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 12px',
            border: '1px solid var(--line)',
            borderRadius: 8,
            marginBottom: 8,
            fontSize: 14,
          }}
        />

        {error && (
          <p role="alert" style={{ color: 'var(--warn-text)', fontSize: 13, margin: '4px 0 12px' }}>
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 16 }}>
          Once signed in, this app works offline — your session stays active for 30 days.
        </p>
      </form>
    </div>
  );
}
