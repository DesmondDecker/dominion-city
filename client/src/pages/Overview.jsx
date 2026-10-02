import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDB } from '../lib/db';
import { loadBranchOverview } from '../lib/branchOverview';
import { getCurrentUser } from '../lib/session';
import BranchPicker from '../components/BranchPicker';
import MiniBarChart from '../components/MiniBarChart';

export default function Overview() {
  const user = getCurrentUser();
  const [branchId, setBranchId] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initBranch();
  }, []);

  useEffect(() => {
    if (branchId) refresh();
  }, [branchId]);

  async function initBranch() {
    // Default to the signed-in staff member's own branch if they have
    // exactly one; otherwise let them pick (national/territory admins
    // scoped to several).
    if (user?.branches?.length === 1) {
      setBranchId(user.branches[0]);
      return;
    }
    const db = await getDB();
    const branches = await db.getAll('branches');
    if (branches.length > 0) setBranchId(branches[0]._id);
    setLoading(false);
  }

  async function refresh() {
    setLoading(true);
    const s = await loadBranchOverview(branchId);
    setStats(s);
    setLoading(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1>Overview</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>
            {stats ? stats.branchName : 'Select a branch'}
          </p>
        </div>
        <div style={{ width: 220 }}>
          <BranchPicker value={branchId} onChange={setBranchId} />
        </div>
      </div>

      {!navigator.onLine && (
        <p style={{ color: 'var(--warn-text)', fontSize: 13, marginBottom: 16 }}>
          This dashboard needs a connection to compute — check back once you're back online.
        </p>
      )}

      {loading && navigator.onLine && <p style={{ color: 'var(--ink-500)' }}>Loading…</p>}

      {!loading && navigator.onLine && !stats && branchId && (
        <p style={{ color: 'var(--ink-500)' }}>No data yet for this branch.</p>
      )}

      {stats && (
        <>
          <div className="responsive-grid-2" style={{ marginBottom: 20 }}>
            <div className="card">
              <p style={{ fontSize: 13, color: 'var(--ink-500)' }}>First-time visitors this month</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--navy-900)', margin: '6px 0' }}>
                {stats.firstTimeVisitors}
              </p>
            </div>
            <div className="card">
              <p style={{ fontSize: 13, color: 'var(--ink-500)' }}>New members this month</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--navy-900)', margin: '6px 0' }}>
                {stats.newMembersThisMonth}
              </p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ marginBottom: 14 }}>Attendance, last 8 weeks</h2>
            {stats.attendance.length > 0 ? (
              <MiniBarChart
                data={stats.attendance}
                labelKey="week"
                valueKey="count"
                height={120}
                formatLabel={(v) => new Date(v).toLocaleDateString('default', { month: 'numeric', day: 'numeric' })}
              />
            ) : (
              <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No check-ins recorded yet for this branch.</p>
            )}
          </div>

          <div className="responsive-grid-2">
            <div className="card">
              <h2>Needs follow-up</h2>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stats.needsFollowUp.length === 0 && (
                  <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No one flagged right now.</p>
                )}
                {stats.needsFollowUp.map((m) => (
                  <Link
                    key={m.id}
                    to={`/members/${m.id}`}
                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, textDecoration: 'none', color: 'inherit' }}
                  >
                    <span>{m.name}</span>
                    <span className="badge warn">
                      {m.weeksAbsent === null ? 'never checked in' : `${m.weeksAbsent} wks absent`}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Upcoming events</h2>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {stats.upcomingEvents.length === 0 && (
                  <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>Nothing scheduled yet.</p>
                )}
                {stats.upcomingEvents.map((e) => (
                  <Link key={e.id} to={`/events/${e.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    <p style={{ fontSize: 14 }}>{e.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
                      {new Date(e.startsAt).toLocaleString('default', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                      {e.location && ` · ${e.location}`}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
