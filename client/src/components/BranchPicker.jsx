import { useEffect, useState } from 'react';
import { getDB } from '../lib/db';

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export default function BranchPicker({ value, onChange }) {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const local = await db.getAll('branches');
      setBranches(local);

      if (navigator.onLine) {
        try {
          const res = await fetch('/api/branches', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
          });
          if (res.ok) setBranches(await res.json());
        } catch {
          // stay on local cache
        }
      }
    })();
  }, []);

  return (
    <select style={inputStyle} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a branch…</option>
      {branches.map((b) => (
        <option key={b._id} value={b._id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
