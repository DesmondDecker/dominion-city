import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadMembers, createMember } from '../lib/members';
import { getDB } from '../lib/db';
import BranchPicker from '../components/BranchPicker';

const STATUS_BADGE = { member: 'good', 'at-risk': 'warn', visitor: 'new' };

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export default function Members() {
  const [members, setMembers] = useState([]);
  const [branchNames, setBranchNames] = useState({});
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    refresh();
    loadBranchNames();
  }, [status]);

  async function loadBranchNames() {
    // A global directory needs to show WHICH branch each result belongs
    // to — otherwise "search everyone" is indistinguishable from
    // "search my branch" in the UI, even though the server already
    // scopes it correctly for national/territory admins.
    const db = await getDB();
    const branches = await db.getAll('branches');
    setBranchNames(Object.fromEntries(branches.map((b) => [b._id, b.name])));
  }

  async function refresh() {
    const results = await loadMembers({ q, status: status || undefined });
    setMembers(results);
  }

  async function handleSearchSubmit(e) {
    e.preventDefault();
    refresh();
  }

  async function handleCreate(form) {
    await createMember(form);
    setShowForm(false);
    refresh();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1>Members</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>{members.length} shown</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Add member
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          style={{ ...inputStyle, maxWidth: 320 }}
          placeholder="Search by name or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select style={{ ...inputStyle, maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="visitor">Visitor</option>
          <option value="member">Member</option>
          <option value="at-risk">At-risk</option>
        </select>
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>

      {showForm && <NewMemberForm onCancel={() => setShowForm(false)} onSubmit={handleCreate} />}

      <div className="card table-scroll" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ink-500)', fontSize: 12 }}>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Name</th>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Branch</th>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Phone</th>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '20px', color: 'var(--ink-500)' }}>
                  No members found.
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m._id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '14px 20px' }}>
                  <Link to={`/members/${m._id}`} style={{ color: 'var(--navy-900)', textDecoration: 'none' }}>
                    {m.firstName} {m.lastName}
                  </Link>
                  {m.pendingSync && (
                    <span className="badge new" style={{ marginLeft: 8 }}>
                      syncing…
                    </span>
                  )}
                </td>
                <td style={{ padding: '14px 20px', color: 'var(--ink-500)' }}>{branchNames[m.branch] || '—'}</td>
                <td style={{ padding: '14px 20px' }}>{m.phone || '—'}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span className={`badge ${STATUS_BADGE[m.status] || 'new'}`}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewMemberForm({ onCancel, onSubmit }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', status: 'visitor', branch: '' });

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginBottom: 14 }}>Add member</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Field label="First name">
          <input style={inputStyle} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </Field>
        <Field label="Last name">
          <input style={inputStyle} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Branch">
          <BranchPicker value={form.branch} onChange={(branch) => setForm({ ...form, branch })} />
        </Field>
        <Field label="Status">
          <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="visitor">Visitor</option>
            <option value="member">Member</option>
          </select>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => onSubmit(form)} disabled={!form.firstName || !form.lastName || !form.branch}>
          Add member
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
