import { useEffect, useRef, useState } from 'react';
import { loadUsers, getUser } from '../lib/users';

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export default function StaffPicker({ value, onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!value) {
      if (selected) {
        setSelected(null);
        setQuery('');
      }
      return;
    }
    if (selected && selected._id === value) return;
    getUser(value).then((user) => {
      if (user) {
        setSelected(user);
        setQuery(user.name);
      }
    });
  }, [value]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setResults(await loadUsers({ q: query }));
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  function handleSelect(user) {
    setSelected(user);
    setQuery(user.name);
    setOpen(false);
    onChange(user._id, user);
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        placeholder={placeholder || 'Search staff by name…'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (selected) {
            setSelected(null);
            onChange('', null);
          }
        }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <div
          className="card"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, padding: 6, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}
        >
          {results.map((u) => (
            <div
              key={u._id}
              onClick={() => handleSelect(u)}
              onMouseDown={(e) => e.preventDefault()}
              style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
            >
              {u.name}
              <span style={{ color: 'var(--ink-500)' }}> · {u.role?.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}
      {open && query && results.length === 0 && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, padding: 10, fontSize: 13, color: 'var(--ink-500)' }}>
          No staff found.
        </div>
      )}
    </div>
  );
}
