import { useEffect, useRef, useState } from 'react';
import { loadMembers, getMember } from '../lib/members';

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

// Controlled component: value is a member _id (or ''), onChange gives
// back the id plus the selected member object for convenience.
export default function MemberPicker({ value, onChange, branchId }) {
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

  // Reflect an externally-set value (e.g. editing an existing record
  // that already has a member assigned) — without this the component
  // ignores `value` entirely and can never be pre-filled.
  useEffect(() => {
    if (!value) {
      if (selected) {
        setSelected(null);
        setQuery('');
      }
      return;
    }
    if (selected && selected._id === value) return;
    getMember(value).then((member) => {
      if (member) {
        setSelected(member);
        setQuery(`${member.firstName} ${member.lastName}`);
      }
    });
  }, [value]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const members = await loadMembers({ q: query });
      setResults(branchId ? members.filter((m) => m.branch === branchId) : members);
    }, 200); // light debounce so we're not hammering the search on every keystroke
    return () => clearTimeout(timeout);
  }, [query, branchId]);

  function handleSelect(member) {
    setSelected(member);
    setQuery(`${member.firstName} ${member.lastName}`);
    setOpen(false);
    onChange(member._id, member);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    onChange('', null);
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        placeholder="Search member by name or phone…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (selected) handleClear();
        }}
        onFocus={() => setOpen(true)}
      />
      {selected && (
        <span style={{ position: 'absolute', right: 10, top: 8, fontSize: 12, color: 'var(--ink-500)' }}>
          selected
        </span>
      )}
      {open && results.length > 0 && (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            padding: 6,
            marginTop: 4,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {results.map((m) => (
            <div
              key={m._id}
              onClick={() => handleSelect(m)}
              style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {m.firstName} {m.lastName}
              {m.phone && <span style={{ color: 'var(--ink-500)' }}> · {m.phone}</span>}
            </div>
          ))}
        </div>
      )}
      {open && query && results.length === 0 && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, padding: 10, fontSize: 13, color: 'var(--ink-500)' }}>
          No members found.
        </div>
      )}
    </div>
  );
}
