import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent, updateEvent, deleteEvent } from '../lib/events';
import { loadRsvps, setRsvp } from '../lib/eventRsvps';

const STATUS_BADGE = { draft: 'new', published: 'good', cancelled: 'warn' };

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [rsvps, setRsvps] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const e = await getEvent(id);
    setEvent(e);
    if (e) setRsvps(await loadRsvps(id));
  }

  async function handlePublish() {
    await updateEvent(id, { status: 'published' });
    load();
  }

  async function handleCancel() {
    await updateEvent(id, { status: 'cancelled' });
    load();
  }

  async function handleTestRsvp() {
    await setRsvp({ event: id, guestName: 'Walk-in RSVP', status: 'going' });
    setRsvps(await loadRsvps(id));
  }

  async function handleEdit(form) {
    await updateEvent(id, form);
    load();
    setShowEditModal(false);
  }

  async function handleDelete() {
    if (confirm(`Are you sure you want to delete event "${event.title}"?`)) {
      await deleteEvent(id);
      navigate('/events');
    }
  }

  if (!event) {
    return (
      <div>
        <h1>Event not found locally</h1>
        <p style={{ color: 'var(--ink-500)', marginTop: 8 }}>
          It may not have synced to this device yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h1>{event.title}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <span className={`badge ${STATUS_BADGE[event.status] || 'new'}`}>{event.status}</span>
            {event.category && <span className="badge new">{event.category}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
            Edit event
          </button>
          <button
            className="btn btn-secondary"
            style={{ color: 'var(--warn-text, #c0392b)' }}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>

      {showEditModal && (
        <EditEventModal
          event={event}
          onCancel={() => setShowEditModal(false)}
          onSubmit={handleEdit}
        />
      )}

      <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
        <Row label="When" value={event.startsAt ? new Date(event.startsAt).toLocaleString() : '—'} />
        <Row label="Location" value={event.location || '—'} />
        <Row label="Applies to" value={event.branches?.length ? `${event.branches.length} branch(es)` : 'All branches'} />
        {event.description && <p style={{ marginTop: 10, fontSize: 14, color: 'var(--ink-700)' }}>{event.description}</p>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {event.status !== 'published' && (
          <button className="btn btn-primary" onClick={handlePublish}>
            Publish
          </button>
        )}
        {event.status !== 'cancelled' && (
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel event
          </button>
        )}
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2>RSVPs ({rsvps.length})</h2>
          <button className="btn btn-secondary" onClick={handleTestRsvp}>
            Add test RSVP
          </button>
        </div>
        {rsvps.length === 0 && <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No RSVPs yet.</p>}
        {rsvps.map((r) => (
          <div key={r._id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 14 }}>
            {r.guestName || r.member}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditEventModal({ event, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    title: event.title || '',
    category: event.category || '',
    startsAt: event.startsAt ? new Date(event.startsAt).toISOString().slice(0, 16) : '',
    location: event.location || '',
    description: event.description || '',
  });

  return (
    <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
      <h2 style={{ marginBottom: 14 }}>Edit event</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Title</label>
          <input
            style={inputStyle}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Category</label>
          <input
            style={inputStyle}
            placeholder="e.g. Service, Conference"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Date & Time</label>
          <input
            style={inputStyle}
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Location</label>
          <input
            style={inputStyle}
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Description</label>
          <input
            style={inputStyle}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={() =>
            onSubmit({
              title: form.title,
              category: form.category,
              startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
              location: form.location,
              description: form.description,
            })
          }
          disabled={!form.title}
        >
          Save changes
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--ink-500)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
