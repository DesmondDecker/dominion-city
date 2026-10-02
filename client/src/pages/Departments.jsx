import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadDepartments, createDepartment } from '../lib/departments';
import { ensureChurchId } from '../lib/church';
import BranchPicker from '../components/BranchPicker';

const STANDARD_DEPARTMENTS = [
  { name: 'Choir', description: 'Music and worship ministration' },
  { name: 'Ushering', description: 'Welcoming and seating' },
  { name: 'Media & Technical', description: 'Sound, projection, livestream' },
  { name: 'Protocol', description: 'Guest and event coordination' },
  { name: "Children's Church", description: 'Kids ministry' },
  { name: 'Evangelism & Mobilisation', description: 'Outreach and soul-winning', trackOutreachContacts: true },
  { name: 'Welfare', description: 'Benevolence and member care' },
  { name: 'Prayer Band', description: 'Intercession and prayer meetings' },
];

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [showBulkSetup, setShowBulkSetup] = useState(false);

  useEffect(() => {
    loadDepartments().then(setDepartments);
  }, []);

  const national = departments.filter((d) => d.scope === 'national');
  const branchScoped = departments.filter((d) => d.scope !== 'national');

  async function handleBulkSetup(branchId) {
    const church = await ensureChurchId();
    for (const dept of STANDARD_DEPARTMENTS) {
      await createDepartment({ ...dept, ...(church ? { church } : {}), scope: 'branch', branch: branchId });
    }
    setShowBulkSetup(false);
    loadDepartments().then(setDepartments);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1>Departments</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>{departments.length} departments</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowBulkSetup(true)}>
            Set up standard departments
          </button>
          <Link to="/departments/new" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Add department
          </Link>
        </div>
      </div>

      {showBulkSetup && <BulkSetup onCancel={() => setShowBulkSetup(false)} onConfirm={handleBulkSetup} />}

      {national.length > 0 && (
        <>
          <h2 style={{ marginBottom: 10 }}>National</h2>
          <DeptGrid departments={national} />
        </>
      )}

      <h2 style={{ margin: national.length ? '24px 0 10px' : '0 0 10px' }}>Branch departments</h2>
      <DeptGrid departments={branchScoped} />
    </div>
  );
}

function BulkSetup({ onCancel, onConfirm }) {
  const [branchId, setBranchId] = useState('');
  const [working, setWorking] = useState(false);

  return (
    <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
      <h2 style={{ marginBottom: 10 }}>Set up standard departments</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 14 }}>
        Creates {STANDARD_DEPARTMENTS.length} common departments for a branch in one go — Choir, Ushering, Media &
        Technical, Protocol, Children's Church, Evangelism & Mobilisation, Welfare, and Prayer Band. You can edit or
        remove any of them afterward.
      </p>
      <div style={{ marginBottom: 14 }}>
        <BranchPicker value={branchId} onChange={setBranchId} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          disabled={!branchId || working}
          onClick={async () => {
            setWorking(true);
            await onConfirm(branchId);
            setWorking(false);
          }}
        >
          {working ? 'Creating…' : `Create ${STANDARD_DEPARTMENTS.length} departments`}
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function DeptGrid({ departments }) {
  if (departments.length === 0) {
    return <p style={{ color: 'var(--ink-500)', marginBottom: 20 }}>None yet.</p>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 8 }}>
      {departments.map((d) => (
        <Link key={d._id} to={`/departments/${d._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card">
            <p style={{ fontSize: 15 }}>{d.name}</p>
            {d.description && <p style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 6 }}>{d.description}</p>}
            {d.pendingSync && (
              <span className="badge new" style={{ marginTop: 8, display: 'inline-block' }}>
                syncing…
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
