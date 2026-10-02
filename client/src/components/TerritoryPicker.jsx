import { useEffect, useState } from 'react';
import { loadTerritories } from '../lib/territories';

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export default function TerritoryPicker({ value, onChange }) {
  const [territories, setTerritories] = useState([]);

  useEffect(() => {
    loadTerritories().then(setTerritories);
  }, []);

  return (
    <select style={inputStyle} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">No territory assigned</option>
      {territories.map((t) => (
        <option key={t._id} value={t._id}>
          {t.name} ({t.type})
        </option>
      ))}
    </select>
  );
}
