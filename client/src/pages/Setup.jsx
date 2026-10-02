import { useEffect, useState } from 'react';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
  marginBottom: 14,
};

export default function Setup() {
  const [checking, setChecking] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [form, setForm] = useState({ churchName: 'Dominion City Church', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/bootstrap')
      .then((res) => res.json())
      .then((data) => {
        setNeedsBootstrap(data.needsBootstrap);
        if (!data.needsBootstrap) window.location.href = '/login';
      })
      .catch(() => setError('Could not reach the server. Check your connection.'))
      .finally(() => setChecking(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-900)' }}>
        <p style={{ color: '#cfe0f2' }}>Checking setup status…</p>
      </div>
    );
  }

  if (!needsBootstrap) return null; // redirecting to /login

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-900)' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 400, background: 'var(--white)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid var(--navy-900)' }} />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--navy-900)' }}>Welcome</span>
        </div>

        <p style={{ fontSize: 14, color: 'var(--ink-700)', marginBottom: 18 }}>
          No admin account exists yet — set one up to get started. This can only be done once.
        </p>

        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', marginBottom: 6 }}>Church name</label>
        <input style={inputStyle} value={form.churchName} onChange={(e) => setForm({ ...form, churchName: e.target.value })} />

        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', marginBottom: 6 }}>Your name</label>
        <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', marginBottom: 6 }}>Your email</label>
        <input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', marginBottom: 6 }}>Password</label>
        <input
          style={inputStyle}
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="At least 8 characters"
        />

        {error && <p role="alert" style={{ color: 'var(--warn-text)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
          {submitting ? 'Setting up…' : 'Create admin account'}
        </button>
      </form>
    </div>
  );
}
