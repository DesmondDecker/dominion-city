import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadEvents, createEvent } from '../lib/events';
import { ensureChurchId } from '../lib/church';
import BranchPicker from '../components/BranchPicker';

const STATUS_BADGE = { draft: 'new', published: 'good', cancelled: 'warn' };

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export default function Events() {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadEvents().then(setEvents);
  }, []);

  async function handleCreate(form) {
    const church = await ensureChurchId();
    await createEvent({
      ...form,
      ...(church ? { church } : {}),
      branches: form.branch ? [form.branch] : [],
      startsAt: new Date(form.startsAt).toISOString(),
    });
    setShowForm(false);
    loadEvents().then(setEvents);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1>Events</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>{events.length} events</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Add event
        </button>
      </div>

      {showForm && <NewEventForm onCancel={() => setShowForm(false)} onSubmit={handleCreate} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {events.length === 0 && (
          <p style={{ color: 'var(--ink-500)' }}>No events yet — add the first one above.</p>
        )}
        {events.map((e) => (
          <Link key={e._id} to={`/events/${e._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ background: 'var(--navy-900)', color: '#fff', padding: '10px 16px' }}>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: 20 }}>
                  {new Date(e.startsAt).getDate()}
                </p>
                <p style={{ fontSize: 11, color: '#a9c0d8', textTransform: 'uppercase' }}>
                  {new Date(e.startsAt).toLocaleString('default', { month: 'long' })}
                </p>
              </div>
              <div style={{ padding: 16 }}>
                <p style={{ fontSize: 14, marginBottom: 6 }}>{e.title}</p>
                <span className={`badge ${STATUS_BADGE[e.status] || 'new'}`}>{e.status}</span>
                {e.pendingSync && (
                  <span className="badge new" style={{ marginLeft: 6 }}>
                    syncing…
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NewEventForm({ onCancel, onSubmit }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
    startsAt: '',
    branch: '',
    status: 'draft',
  });

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ marginBottom: 14 }}>New event</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Field label="Title">
          <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Category">
          <input
            style={inputStyle}
            placeholder="e.g. Youth, Outreach"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </Field>
        <Field label="Date & time">
          <input
            style={inputStyle}
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
          />
        </Field>
        <Field label="Location">
          <input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </Field>
        <Field label="Branch (leave blank = applies to all branches)">
          <BranchPicker value={form.branch} onChange={(branch) => setForm({ ...form, branch })} />
        </Field>
        <Field label="Description">
          <input style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={() => onSubmit(form)}
          disabled={!form.title || !form.startsAt}
        >
          Create event
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
