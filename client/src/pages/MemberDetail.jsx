import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMember, updateMember, deleteMember } from '../lib/members';
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

export default function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [branchNames, setBranchNames] = useState({});
  const [transferTo, setTransferTo] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    getMember(id).then(setMember);
    loadBranchNames();
  }, [id]);

  async function loadBranchNames() {
    const db = await getDB();
    const branches = await db.getAll('branches');
    setBranchNames(Object.fromEntries(branches.map((b) => [b._id, b.name])));
  }

  async function handleStatusChange(status) {
    await updateMember(id, { status });
    setMember({ ...member, status });
  }

  async function handleTransfer() {
    if (!transferTo || transferTo === member.branch) return;
    setTransferring(true);
    await updateMember(id, { branch: transferTo });
    const fresh = await getMember(id);
    setMember(fresh);
    setTransferTo('');
    setTransferring(false);
  }

  async function handleEdit(form) {
    await updateMember(id, form);
    const fresh = await getMember(id);
    setMember(fresh);
    setShowEditModal(false);
  }

  async function handleDelete() {
    if (confirm(`Are you sure you want to delete member "${member.firstName} ${member.lastName}"?`)) {
      await deleteMember(id);
      navigate('/members');
    }
  }

  if (!member) {
    return (
      <div>
        <h1>Member not found locally</h1>
        <p style={{ color: 'var(--ink-500)', marginTop: 8 }}>
          It may not have synced to this device yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1>
            {member.firstName} {member.lastName}
          </h1>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`badge ${STATUS_BADGE[member.status] || 'new'}`}>{member.status}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>{branchNames[member.branch] || 'Unknown branch'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
            Edit details
          </button>
          <button
            className="btn btn-secondary"
            style={{ color: 'var(--warn-text, #c0392b)' }}
            onClick={handleDelete}
          >
            Delete member
          </button>
        </div>
      </div>

      {showEditModal && (
        <EditMemberModal
          member={member}
          onCancel={() => setShowEditModal(false)}
          onSubmit={handleEdit}
        />
      )}

      <div className="card" style={{ maxWidth: 480, marginBottom: 20 }}>
        <h2 style={{ marginBottom: 14 }}>Details</h2>
        <Row label="Phone" value={member.phone || '—'} />
        <Row label="Email" value={member.email || '—'} />
        <Row label="Household" value={member.household || '—'} />
        <Row label="Joined" value={member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'} />
        <Row label="Last attended" value={member.lastAttendedAt ? new Date(member.lastAttendedAt).toLocaleDateString() : '—'} />

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {['visitor', 'member', 'at-risk'].map((s) => (
            <button
              key={s}
              className={`btn ${member.status === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleStatusChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480, marginBottom: 20 }}>
        <h2 style={{ marginBottom: 14 }}>Transfer branch</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 12 }}>
          Currently at <strong>{branchNames[member.branch] || 'Unknown branch'}</strong>. Transferring — including
          across a border — is logged in their history below.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <BranchPicker value={transferTo} onChange={setTransferTo} />
          </div>
          <button className="btn btn-primary" onClick={handleTransfer} disabled={!transferTo || transferring}>
            {transferring ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </div>

      {member.transferHistory?.length > 0 && (
        <div className="card" style={{ maxWidth: 480 }}>
          <h2 style={{ marginBottom: 14 }}>Transfer history</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {member.transferHistory.map((t, i) => (
              <div key={i} style={{ fontSize: 13, borderTop: i > 0 ? '1px solid var(--line)' : 'none', paddingTop: i > 0 ? 8 : 0 }}>
                {branchNames[t.fromBranch] || 'Unknown'} → {branchNames[t.toBranch] || 'Unknown'}
                <span style={{ color: 'var(--ink-500)' }}> · {new Date(t.transferredAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EditMemberModal({ member, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    firstName: member.firstName || '',
    lastName: member.lastName || '',
    phone: member.phone || '',
    email: member.email || '',
    household: member.household || '',
  });

  return (
    <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
      <h2 style={{ marginBottom: 14 }}>Edit member details</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>First name</label>
          <input
            style={inputStyle}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Last name</label>
          <input
            style={inputStyle}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Phone</label>
          <input
            style={inputStyle}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Email</label>
          <input
            style={inputStyle}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Household / Family</label>
          <input
            style={inputStyle}
            placeholder="e.g. Decker Family"
            value={form.household}
            onChange={(e) => setForm({ ...form, household: e.target.value })}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={() => onSubmit(form)}
          disabled={!form.firstName || !form.lastName}
        >
          Save changes
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--ink-500)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
