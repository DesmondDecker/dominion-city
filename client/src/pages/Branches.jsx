import { useEffect, useState } from 'react';
import { loadBranches, createBranch, updateBranch, deleteBranch } from '../lib/branches';
import TerritoryPicker from '../components/TerritoryPicker';

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const list = await loadBranches();
    setBranches(list);
  }

  async function handleAdd(form) {
    await createBranch(form);
    setShowAddModal(false);
    refresh();
  }

  async function handleEdit(form) {
    if (!editingBranch) return;
    await updateBranch(editingBranch._id, form);
    setEditingBranch(null);
    refresh();
  }

  async function handleDelete(id, name) {
    if (confirm(`Are you sure you want to delete branch "${name}"?`)) {
      await deleteBranch(id);
      refresh();
    }
  }

  async function assignTerritory(branchId, territoryId) {
    await updateBranch(branchId, { territory: territoryId || null });
    refresh();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1>Branches & fellowships</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>{branches.length} locations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          Add branch
        </button>
      </div>

      {showAddModal && (
        <BranchFormModal
          title="Add branch / fellowship"
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingBranch && (
        <BranchFormModal
          title="Edit branch / fellowship"
          initialValues={editingBranch}
          onCancel={() => setEditingBranch(null)}
          onSubmit={handleEdit}
        />
      )}

      <div className="card table-scroll" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ink-500)', fontSize: 12 }}>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Name</th>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Type</th>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Address</th>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Status</th>
              <th style={{ padding: '14px 20px', fontWeight: 400 }}>Territory</th>
              <th style={{ padding: '14px 20px', fontWeight: 400, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '20px', color: 'var(--ink-500)' }}>
                  No branches yet — add the first one above.
                </td>
              </tr>
            )}
            {branches.map((b) => (
              <tr key={b._id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '14px 20px', fontWeight: 500 }}>{b.name}</td>
                <td style={{ padding: '14px 20px', textTransform: 'capitalize' }}>{b.type}</td>
                <td style={{ padding: '14px 20px', color: 'var(--ink-500)' }}>{b.address || '—'}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span className={`badge ${b.status === 'active' ? 'good' : 'new'}`}>
                    {b.status || 'pending'}
                  </span>
                </td>
                <td style={{ padding: '10px 20px', maxWidth: 200 }}>
                  <TerritoryPicker value={b.territory} onChange={(territoryId) => assignTerritory(b._id, territoryId)} />
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => setEditingBranch(b)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 12, color: 'var(--warn-text, #c0392b)' }}
                      onClick={() => handleDelete(b._id, b.name)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BranchFormModal({ title, initialValues, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    name: initialValues?.name || '',
    type: initialValues?.type || 'branch',
    address: initialValues?.address || '',
    status: initialValues?.status || 'active',
  });

  return (
    <div className="card" style={{ marginBottom: 20, maxWidth: 500 }}>
      <h2 style={{ marginBottom: 14 }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>
            Branch Name
          </label>
          <input
            style={inputStyle}
            placeholder="e.g. Freetown Central, Wilkinson Road"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>
            Type
          </label>
          <select
            style={inputStyle}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="branch">Branch</option>
            <option value="fellowship">Fellowship</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>
            Status
          </label>
          <select
            style={inputStyle}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>
            Address / Location
          </label>
          <input
            style={inputStyle}
            placeholder="e.g. 15 Wilkinson Road, Freetown"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={() => onSubmit(form)}
          disabled={!form.name}
        >
          Save
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
