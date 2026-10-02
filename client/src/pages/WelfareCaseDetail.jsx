import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDB } from '../lib/db';
import { recordDisbursement, logVisit } from '../lib/welfare';

export default function WelfareCaseDetail() {
  const { id } = useParams();
  const [kase, setKase] = useState(null);
  const [disbursements, setDisbursements] = useState([]);
  const [visits, setVisits] = useState([]);
  const [tab, setTab] = useState('disbursements');

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const db = await getDB();
    const cached = await db.get('welfareCases', id);
    setKase(cached || null);

    if (navigator.onLine) {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
        const [caseRes, disbRes, visitRes] = await Promise.all([
          fetch(`/api/welfare-cases?id=${id}`, { headers }),
          fetch(`/api/welfare-disbursements?caseId=${id}`, { headers }),
          fetch(`/api/welfare-visits?caseId=${id}`, { headers }),
        ]);
        if (caseRes.ok) {
          const full = await caseRes.json();
          setKase(full);
          await db.put('welfareCases', full);
        }
        if (disbRes.ok) setDisbursements(await disbRes.json());
        else setDisbursements((await db.getAll('welfareDisbursements')).filter((d) => d.case === id));
        if (visitRes.ok) setVisits(await visitRes.json());
        else setVisits((await db.getAll('welfareVisits')).filter((v) => v.case === id));
      } catch {
        // request itself failed (server unreachable despite navigator.onLine
        // saying we're connected) — fall back to whatever's cached locally
        // instead of leaving the lists empty.
        const localDisb = await db.getAll('welfareDisbursements');
        const localVisits = await db.getAll('welfareVisits');
        setDisbursements(localDisb.filter((d) => d.case === id));
        setVisits(localVisits.filter((v) => v.case === id));
      }
    } else {
      const localDisb = await db.getAll('welfareDisbursements');
      const localVisits = await db.getAll('welfareVisits');
      setDisbursements(localDisb.filter((d) => d.case === id));
      setVisits(localVisits.filter((v) => v.case === id));
    }
  }

  async function handleDisbursement(form) {
    await recordDisbursement({ case: id, ...form });
    load();
  }

  async function handleVisit(form) {
    await logVisit({ case: id, ...form });
    load();
  }

  if (!kase) {
    return (
      <div>
        <h1>Case not found locally</h1>
        <p style={{ color: 'var(--ink-500)', marginTop: 8 }}>
          It may not have synced to this device yet, or you may not have access.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>{kase.summary}</h1>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 24 }}>
        <span className="badge new" style={{ textTransform: 'capitalize' }}>
          {kase.category?.replace('_', ' ')}
        </span>
        <span className="badge warn" style={{ textTransform: 'capitalize' }}>
          {kase.priority}
        </span>
        <span className="badge good" style={{ textTransform: 'capitalize' }}>
          {kase.status?.replace('_', ' ')}
        </span>
      </div>

      {kase.details && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Details</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-700)' }}>{kase.details}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn ${tab === 'disbursements' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('disbursements')}
        >
          Disbursements
        </button>
        <button
          className={`btn ${tab === 'visits' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('visits')}
        >
          Visit log
        </button>
      </div>

      {tab === 'disbursements' && (
        <DisbursementPanel disbursements={disbursements} onSubmit={handleDisbursement} />
      )}
      {tab === 'visits' && <VisitPanel visits={visits} onSubmit={handleVisit} />}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

function DisbursementPanel({ disbursements, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="card">
      <h2 style={{ marginBottom: 14 }}>Record a disbursement</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          style={inputStyle}
          placeholder="Amount (SLL)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          style={inputStyle}
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={() => {
            onSubmit({ type: 'financial', amount: Number(amount), currency: 'SLL', note });
            setAmount('');
            setNote('');
          }}
        >
          Record
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {disbursements.length === 0 && (
          <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No disbursements recorded yet.</p>
        )}
        {disbursements.map((d) => (
          <div
            key={d.clientEventId || d._id}
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px solid var(--line)', paddingTop: 10 }}
          >
            <span>{d.amount ? `${d.amount} ${d.currency}` : (d.itemsGiven || []).join(', ')}</span>
            <span style={{ color: 'var(--ink-500)' }}>
              {new Date(d.disbursedAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisitPanel({ visits, onSubmit }) {
  const [notes, setNotes] = useState('');
  const [visitType, setVisitType] = useState('home');

  return (
    <div className="card">
      <h2 style={{ marginBottom: 14 }}>Log a visit</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select style={{ ...inputStyle, width: 140 }} value={visitType} onChange={(e) => setVisitType(e.target.value)}>
          <option value="home">Home visit</option>
          <option value="hospital">Hospital visit</option>
          <option value="phone">Phone call</option>
          <option value="other">Other</option>
        </select>
        <input
          style={inputStyle}
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={() => {
            onSubmit({ visitType, notes });
            setNotes('');
          }}
        >
          Log visit
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visits.length === 0 && (
          <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No visits logged yet.</p>
        )}
        {visits.map((v) => (
          <div
            key={v.clientEventId || v._id}
            style={{ borderTop: '1px solid var(--line)', paddingTop: 10, fontSize: 14 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ textTransform: 'capitalize' }}>{v.visitType}</span>
              <span style={{ color: 'var(--ink-500)' }}>{new Date(v.visitDate).toLocaleDateString()}</span>
            </div>
            {v.notes && <p style={{ marginTop: 4, color: 'var(--ink-700)' }}>{v.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
