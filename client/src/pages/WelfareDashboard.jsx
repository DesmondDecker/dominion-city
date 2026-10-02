import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCases, createCase } from '../lib/welfare';
import MemberPicker from '../components/MemberPicker';
import BranchPicker from '../components/BranchPicker';

const PRIORITY_BADGE = { urgent: 'warn', high: 'warn', medium: 'new', low: 'good' };
const STATUS_LABEL = {
  open: 'Open',
  in_review: 'In review',
  approved: 'Approved',
  declined: 'Declined',
  closed: 'Closed',
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'var(--font-sans)',
};

export default function WelfareDashboard() {
  const [cases, setCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadCases().then(setCases);
  }, []);

  const visible = cases.filter((c) =>
    statusFilter === 'active' ? c.status !== 'closed' && c.status !== 'declined' : true
  );

  async function handleCreate(form) {
    await createCase(form);
    setShowForm(false);
    loadCases().then(setCases);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1>Welfare</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>
            Benevolence cases, home visits, and disbursements. Visible only to assigned caseworkers and admins.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          New case
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn ${statusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('active')}
        >
          Active
        </button>
        <button
          className={`btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('all')}
        >
          All
        </button>
      </div>

      {showForm && <NewCaseForm onCancel={() => setShowForm(false)} onSubmit={handleCreate} />}

      <div className="card table-scroll" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ink-500)', fontSize: 12 }}>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Summary</th>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Category</th>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Priority</th>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '20px', color: 'var(--ink-500)' }}>
                  No cases to show.
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <tr key={c._id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '14px 20px' }}>
                  <Link to={`/welfare/${c._id}`} style={{ color: 'var(--navy-900)', textDecoration: 'none' }}>
                    {c.summary}
                  </Link>
                </td>
                <td style={{ padding: '14px 20px', textTransform: 'capitalize' }}>
                  {c.category?.replace('_', ' ')}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span className={`badge ${PRIORITY_BADGE[c.priority] || 'new'}`}>{c.priority}</span>
                </td>
                <td style={{ padding: '14px 20px' }}>{STATUS_LABEL[c.status] || c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewCaseForm({ onCancel, onSubmit }) {
  const [form, setForm] = useState({
    category: 'financial_hardship',
    priority: 'medium',
    summary: '',
    member: '',
    branch: '',
  });

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginBottom: 14 }}>New welfare case</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Field label="Summary (visible on the case list — keep it general)">
          <input
            style={inputStyle}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="e.g. Requesting support with rent"
          />
        </Field>
        <Field label="Category">
          <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="financial_hardship">Financial hardship</option>
            <option value="medical">Medical</option>
            <option value="bereavement">Bereavement</option>
            <option value="food">Food</option>
            <option value="housing">Housing</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Priority">
          <select style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
        <Field label="Branch">
          <BranchPicker value={form.branch} onChange={(branch) => setForm({ ...form, branch })} />
        </Field>
        <Field label="Member">
          <MemberPicker
            value={form.member}
            branchId={form.branch}
            onChange={(member) => setForm({ ...form, member })}
          />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => onSubmit(form)} disabled={!form.summary || !form.member || !form.branch}>
          Create case
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
