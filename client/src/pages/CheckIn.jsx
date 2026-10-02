import { useEffect, useState } from 'react';
import { loadMembers } from '../lib/members';
import { checkInMember, undoCheckIn, loadTodayCheckins, loadRangeCheckins } from '../lib/checkIn';
import { getCurrentUser } from '../lib/session';
import BranchPicker from '../components/BranchPicker';

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
};

export default function CheckIn() {
  const user = getCurrentUser();
  const [branchId, setBranchId] = useState(user?.branches?.[0] || '');
  const [mode, setMode] = useState('live'); // 'live' or 'weekly'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [checkedIn, setCheckedIn] = useState(new Map());

  useEffect(() => {
    if (branchId && mode === 'live') refreshCount();
  }, [branchId, mode]);

  useEffect(() => {
    if (!query.trim() || mode !== 'live') {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const members = await loadMembers({ q: query });
      setResults(members);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, mode]);

  async function refreshCount() {
    const todays = await loadTodayCheckins(branchId);
    setCheckedIn(new Map(todays.map((c) => [c.member, c])));
  }

  async function handleCheckIn(member) {
    if (!branchId) return;
    const entry = await checkInMember({
      branchId,
      memberId: member._id,
      checkedInBy: user?.userId,
      device: navigator.userAgent,
    });
    setCheckedIn((prev) => new Map(prev).set(member._id, entry));
  }

  async function handleUndo(member) {
    const original = checkedIn.get(member._id);
    if (!original) return;
    await undoCheckIn({
      branchId,
      memberId: member._id,
      reversalOfClientEventId: original.clientEventId,
      checkedInBy: user?.userId,
      device: navigator.userAgent,
    });
    setCheckedIn((prev) => {
      const next = new Map(prev);
      next.delete(member._id);
      return next;
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1>Check in & Attendance</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>
            {new Date().toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 220 }}>
            <BranchPicker value={branchId} onChange={setBranchId} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`btn ${mode === 'live' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('live')}
        >
          Live check-in
        </button>
        <button
          className={`btn ${mode === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('weekly')}
        >
          Weekly attendance sheet
        </button>
      </div>

      {!branchId ? (
        <p style={{ color: 'var(--ink-500)' }}>Select a branch to start marking attendance.</p>
      ) : mode === 'live' ? (
        <>
          <input
            style={{ ...inputStyle, marginBottom: 16 }}
            placeholder="Search name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {results.map((m) => {
              const done = checkedIn.has(m._id);
              return (
                <div
                  key={m._id}
                  className="card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 18px',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 15 }}>{m.firstName} {m.lastName}</p>
                    {m.household && <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>{m.household}</p>}
                  </div>
                  <button
                    onClick={() => (done ? handleUndo(m) : handleCheckIn(m))}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: done ? 'none' : '1.5px solid var(--line)',
                      background: done ? '#5fc48b' : 'var(--white)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 16,
                    }}
                    aria-label={done ? `Undo check-in for ${m.firstName} ${m.lastName}` : `Check in ${m.firstName} ${m.lastName}`}
                    title={done ? 'Tap to undo' : undefined}
                  >
                    {done ? '✓' : ''}
                  </button>
                </div>
              );
            })}
            {query && results.length === 0 && (
              <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No members found.</p>
            )}
          </div>

          <div className="card" style={{ textAlign: 'center', maxWidth: 260 }}>
            <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>Checked in so far today</p>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--navy-900)', marginTop: 4 }}>
              {checkedIn.size}
            </p>
          </div>
        </>
      ) : (
        <WeeklyAttendanceSheet branchId={branchId} userId={user?.userId} />
      )}
    </div>
  );
}

function WeeklyAttendanceSheet({ branchId, userId }) {
  const [members, setMembers] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [weeks, setWeeks] = useState([]);
  const [checkinMap, setCheckinMap] = useState(new Map()); // "memberId_dateKey" -> checkinRecord
  const [loading, setLoading] = useState(true);

  // Generate recent 6 Sundays
  useEffect(() => {
    const list = [];
    const today = new Date();
    const currentSunday = new Date(today);
    currentSunday.setDate(today.getDate() - today.getDay());

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentSunday);
      d.setDate(currentSunday.getDate() - i * 7);
      d.setHours(0, 0, 0, 0);
      list.push(d);
    }
    setWeeks(list);
  }, []);

  useEffect(() => {
    if (branchId && weeks.length > 0) {
      loadData();
    }
  }, [branchId, weeks]);

  async function loadData() {
    setLoading(true);
    const startDate = weeks[0].toISOString();
    const endDate = weeks[weeks.length - 1].toISOString();

    const [memList, rawCheckins] = await Promise.all([
      loadMembers(),
      loadRangeCheckins(branchId, startDate, endDate),
    ]);

    const branchMembers = memList.filter((m) => !m.branch || m.branch === branchId);
    setMembers(branchMembers);

    const map = new Map();
    for (const c of rawCheckins) {
      const dKey = new Date(c.serviceDate).toDateString();
      const key = `${c.member}_${dKey}`;
      map.set(key, c);
    }
    setCheckinMap(map);
    setLoading(false);
  }

  async function toggleCheck(memberId, weekDate) {
    const dKey = weekDate.toDateString();
    const key = `${memberId}_${dKey}`;
    const existing = checkinMap.get(key);

    if (existing) {
      await undoCheckIn({
        branchId,
        memberId,
        reversalOfClientEventId: existing.clientEventId,
        checkedInBy: userId,
        device: navigator.userAgent,
      });
      setCheckinMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    } else {
      const entry = await checkInMember({
        branchId,
        memberId,
        serviceDate: weekDate.toISOString(),
        checkedInBy: userId,
        device: navigator.userAgent,
      });
      setCheckinMap((prev) => new Map(prev).set(key, entry));
    }
  }

  const filteredMembers = members.filter((m) =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <input
          style={{ ...inputStyle, maxWidth: 300 }}
          placeholder="Filter members by name…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>
          {filteredMembers.length} member(s) shown
        </span>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>Loading weekly sheet…</p>
      ) : (
        <div className="card table-scroll" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--navy-50, #f4f6fa)', color: 'var(--ink-500)', fontSize: 12 }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Member Name</th>
                {weeks.map((w) => (
                  <th key={w.toISOString()} style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, minWidth: 90 }}>
                    {w.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                  </th>
                ))}
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={weeks.length + 2} style={{ padding: 20, color: 'var(--ink-500)' }}>
                    No members found.
                  </td>
                </tr>
              )}
              {filteredMembers.map((m) => {
                let attendedCount = 0;
                return (
                  <tr key={m._id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {m.firstName} {m.lastName}
                    </td>
                    {weeks.map((w) => {
                      const key = `${m._id}_${w.toDateString()}`;
                      const isChecked = checkinMap.has(key);
                      if (isChecked) attendedCount++;
                      return (
                        <td key={w.toISOString()} style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheck(m._id, w)}
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--navy-900)' }}
                            title={`${m.firstName} ${m.lastName} - ${w.toLocaleDateString()}`}
                          />
                        </td>
                      );
                    })}
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>
                      {attendedCount} / {weeks.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--line)', background: 'var(--navy-50, #f4f6fa)', fontWeight: 600, fontSize: 13 }}>
                <td style={{ padding: '12px 16px' }}>Total Present</td>
                {weeks.map((w) => {
                  const dateStr = w.toDateString();
                  let colTotal = 0;
                  for (const m of filteredMembers) {
                    if (checkinMap.has(`${m._id}_${dateStr}`)) colTotal++;
                  }
                  return (
                    <td key={w.toISOString()} style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {colTotal}
                    </td>
                  );
                })}
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
