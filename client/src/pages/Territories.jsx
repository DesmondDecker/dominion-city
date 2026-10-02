import { useEffect, useState } from 'react';
import { loadTerritories, createTerritory, loadTerritoryStats } from '../lib/territories';
import { ensureChurchId } from '../lib/church';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export default function Territories() {
  const [territories, setTerritories] = useState([]);
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setTerritories(await loadTerritories());
    setStats(await loadTerritoryStats());
  }

  async function handleCreate(form) {
    const church = await ensureChurchId();
    await createTerritory({ ...form, ...(church ? { church } : {}), parentTerritory: form.parentTerritory || null });
    setShowForm(false);
    refresh();
  }

  // Roll branch-level stats up to whichever territory each branch belongs to.
  const byTerritory = {};
  if (stats) {
    for (const b of stats.branches) {
      const key = b.territory || 'unassigned';
      if (!byTerritory[key]) byTerritory[key] = { members: 0, checkedInToday: 0, branchCount: 0 };
      byTerritory[key].members += b.members;
      byTerritory[key].checkedInToday += b.checkedInToday;
      byTerritory[key].branchCount += 1;
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1>Territories</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>
            Continents, countries, and regions — how branches roll up across a global footprint.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Add territory
        </button>
      </div>

      {showForm && <NewTerritoryForm territories={territories} onCancel={() => setShowForm(false)} onSubmit={handleCreate} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {territories.length === 0 && <p style={{ color: 'var(--ink-500)' }}>No territories yet — add the first one above.</p>}
        {territories.map((t) => {
          const s = byTerritory[t._id] || { members: 0, checkedInToday: 0, branchCount: 0 };
          const parent = territories.find((p) => p._id === t.parentTerritory);
          return (
            <div className="card" key={t._id}>
              <p style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'uppercase' }}>{t.type}</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--navy-900)', margin: '4px 0' }}>
                {t.name}
              </p>
              {parent && <p style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 8 }}>Under {parent.name}</p>}
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13 }}>
                <span><strong>{s.branchCount}</strong> branches</span>
                <span><strong>{s.members}</strong> members</span>
                <span><strong>{s.checkedInToday}</strong> checked in today</span>
              </div>
            </div>
          );
        })}
      </div>

      {stats && byTerritory.unassigned && (
        <p style={{ color: 'var(--ink-500)', fontSize: 13, marginTop: 20 }}>
          {byTerritory.unassigned.branchCount} branch(es) have no territory assigned yet — edit them from the Branches page.
        </p>
      )}
    </div>
  );
}

function NewTerritoryForm({ territories, onCancel, onSubmit }) {
  const [form, setForm] = useState({ name: '', type: 'country', parentTerritory: '' });

  return (
    <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
      <h2 style={{ marginBottom: 14 }}>New territory</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <input style={inputStyle} placeholder="e.g. West Africa, Sierra Leone" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="continent">Continent</option>
          <option value="country">Country</option>
          <option value="region">Region</option>
        </select>
        <select style={inputStyle} value={form.parentTerritory} onChange={(e) => setForm({ ...form, parentTerritory: e.target.value })}>
          <option value="">No parent (top level)</option>
          {territories.map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => onSubmit(form)} disabled={!form.name}>
          Create territory
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
