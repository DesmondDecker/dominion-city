import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
  marginBottom: 16,
};

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This invite link is missing its token.');
      return;
    }
    fetch(`/api/accept-invite?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'This invite link is invalid.');
          return;
        }
        setInvite(data);
      })
      .catch(() => setError('Could not reach the server. Check your connection.'));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      localStorage.setItem('token', data.token);
      window.location.href = '/';
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-900)' }}>
      <div className="card" style={{ width: 380, background: 'var(--white)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid var(--navy-900)' }} />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--navy-900)' }}>Dominion City</span>
        </div>

        {!invite && !error && <p style={{ color: 'var(--ink-500)' }}>Checking your invite…</p>}

        {error && <p role="alert" style={{ color: 'var(--warn-text)', fontSize: 14 }}>{error}</p>}

        {invite && (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: 14, marginBottom: 16 }}>
              Welcome, <strong>{invite.name}</strong> — set a password to join as{' '}
              <strong>{invite.role.replace('_', ' ')}</strong>.
            </p>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', marginBottom: 6 }}>Password</label>
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Setting up…' : 'Set password & sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
