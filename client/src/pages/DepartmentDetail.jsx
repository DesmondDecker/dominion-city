import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDepartment, addToRoster, removeFromRoster, updateDepartment, deleteDepartment } from '../lib/departments';
import { loadMembers } from '../lib/members';
import { loadDuties, scheduleDuty } from '../lib/departmentDuties';
import { markPresent, loadTodayAttendance } from '../lib/departmentAttendance';
import { logContact, loadContacts, convertContactToMember } from '../lib/evangelismContacts';
import { getCurrentUser } from '../lib/session';
import MemberPicker from '../components/MemberPicker';
import StaffPicker from '../components/StaffPicker';

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export default function DepartmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [dept, setDept] = useState(null);
  const [roster, setRoster] = useState([]);
  const [duties, setDuties] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [tab, setTab] = useState('roster');
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const d = await getDepartment(id);
    setDept(d);
    if (d) {
      setRoster(await loadMembers({ departmentId: id }));
      setDuties(await loadDuties(id));
      setAttendance(await loadTodayAttendance(id));
      if (d.trackOutreachContacts) setContacts(await loadContacts(id));
    }
  }

  async function handleLogContact(form) {
    await logContact({ departmentId: id, ...form });
    setContacts(await loadContacts(id));
  }

  async function handleConvertContact(contact) {
    if (!dept.branch) {
      alert('This department has no branch assigned, so there\u2019s no branch to add the new member under. Assign one on the Branches page first.');
      return;
    }
    try {
      await convertContactToMember(contact, dept.branch);
      setContacts(await loadContacts(id));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleAssignHead(headUserId) {
    await updateDepartment(id, { headUser: headUserId || null });
    setDept({ ...dept, headUser: headUserId || null });
  }

  async function handleMarkPresent(memberId) {
    await markPresent({ departmentId: id, memberId, markedBy: user?.userId });
    setAttendance(await loadTodayAttendance(id));
  }

  async function handleAddMember(memberId) {
    if (!memberId) return;
    await addToRoster(memberId, id);
    load();
  }

  async function handleRemoveMember(memberId) {
    await removeFromRoster(memberId, id);
    load();
  }

  async function handleScheduleDuty(form) {
    await scheduleDuty({ department: id, ...form });
    setDuties(await loadDuties(id));
  }

  async function handleEditDepartment(form) {
    await updateDepartment(id, form);
    const fresh = await getDepartment(id);
    setDept(fresh);
    setShowEditModal(false);
  }

  async function handleDeleteDepartment() {
    if (confirm(`Are you sure you want to delete department "${dept.name}"?`)) {
      await deleteDepartment(id);
      navigate('/departments');
    }
  }

  if (!dept) {
    return (
      <div>
        <h1>Department not found locally</h1>
        <p style={{ color: 'var(--ink-500)', marginTop: 8 }}>It may not have synced to this device yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h1>{dept.name}</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 6 }}>
            {dept.scope === 'national' ? 'National department' : 'Branch department'}
            {dept.defaultMeeting?.dayOfWeek && ` · Meets ${dept.defaultMeeting.dayOfWeek} ${dept.defaultMeeting.time || ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
            Edit department
          </button>
          <button
            className="btn btn-secondary"
            style={{ color: 'var(--warn-text, #c0392b)' }}
            onClick={handleDeleteDepartment}
          >
            Delete
          </button>
        </div>
      </div>

      {showEditModal && (
        <EditDepartmentModal
          dept={dept}
          onCancel={() => setShowEditModal(false)}
          onSubmit={handleEditDepartment}
        />
      )}

      <div style={{ maxWidth: 320, marginBottom: 20 }}>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', marginBottom: 6 }}>Department head</span>
        <StaffPicker value={dept.headUser} onChange={(headUserId) => handleAssignHead(headUserId)} placeholder="Assign a department head…" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${tab === 'roster' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('roster')}>
          Roster ({roster.length})
        </button>
        <button className={`btn ${tab === 'duties' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('duties')}>
          Duty roster
        </button>
        <button className={`btn ${tab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('attendance')}>
          Meeting attendance
        </button>
        {dept.trackOutreachContacts && (
          <button className={`btn ${tab === 'contacts' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('contacts')}>
            Outreach contacts
          </button>
        )}
      </div>

      {tab === 'roster' && (
        <div className="card">
          <h2 style={{ marginBottom: 14 }}>Add a member</h2>
          <MemberPicker onChange={(memberId) => handleAddMember(memberId)} />
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roster.length === 0 && <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No members yet.</p>}
            {roster.map((m) => (
              <div key={m._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <span>{m.firstName} {m.lastName}</span>
                <button className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => handleRemoveMember(m._id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'duties' && <DutyPanel duties={duties} onSubmit={handleScheduleDuty} />}
      {tab === 'attendance' && (
        <AttendancePanel deptId={id} roster={roster} attendance={attendance} onMark={handleMarkPresent} />
      )}
      {tab === 'contacts' && <ContactPanel contacts={contacts} onSubmit={handleLogContact} onConvert={handleConvertContact} />}
    </div>
  );
}

function EditDepartmentModal({ dept, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    name: dept.name || '',
    description: dept.description || '',
    meetingDay: dept.defaultMeeting?.dayOfWeek || '',
    meetingTime: dept.defaultMeeting?.time || '',
    trackOutreachContacts: !!dept.trackOutreachContacts,
  });

  return (
    <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
      <h2 style={{ marginBottom: 14 }}>Edit department</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Department Name</label>
          <input
            style={inputStyle}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Meeting Day</label>
          <input
            style={inputStyle}
            placeholder="e.g. Wednesday"
            value={form.meetingDay}
            onChange={(e) => setForm({ ...form, meetingDay: e.target.value })}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>Meeting Time</label>
          <input
            style={inputStyle}
            placeholder="e.g. 6:00pm"
            value={form.meetingTime}
            onChange={(e) => setForm({ ...form, meetingTime: e.target.value })}
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

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-700)', marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={form.trackOutreachContacts}
          onChange={(e) => setForm({ ...form, trackOutreachContacts: e.target.checked })}
        />
        Tracks outreach contacts (soul-winning records)
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={() =>
            onSubmit({
              name: form.name,
              description: form.description,
              defaultMeeting: form.meetingDay ? { dayOfWeek: form.meetingDay, time: form.meetingTime } : undefined,
              trackOutreachContacts: form.trackOutreachContacts,
            })
          }
          disabled={!form.name}
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

const OUTCOME_BADGE = {
  accepted_christ: 'good',
  interested: 'new',
  not_interested: 'warn',
  already_member: 'good',
  other: 'new',
};

function DutyPanel({ duties, onSubmit }) {
  const [form, setForm] = useState({ title: '', assignedMember: '', date: '', notes: '' });
  return (
    <div className="card">
      <h2 style={{ marginBottom: 14 }}>Schedule duty</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <input style={inputStyle} placeholder="Duty title (e.g. Opening Prayer, Solo)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input style={inputStyle} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <div style={{ gridColumn: '1 / -1' }}>
          <MemberPicker value={form.assignedMember} onChange={(id) => setForm({ ...form, assignedMember: id })} placeholder="Assign to member…" />
        </div>
      </div>
      <button
        className="btn btn-primary"
        style={{ marginBottom: 20 }}
        disabled={!form.title || !form.date}
        onClick={() => {
          onSubmit({ ...form, date: new Date(form.date).toISOString() });
          setForm({ title: '', assignedMember: '', date: '', notes: '' });
        }}
      >
        Schedule
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {duties.length === 0 && <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No duties scheduled yet.</p>}
        {duties.map((d) => (
          <div key={d._id} style={{ borderTop: '1px solid var(--line)', paddingTop: 8, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>{d.title}</strong> · {new Date(d.date).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactPanel({ contacts, onSubmit, onConvert }) {
  const [form, setForm] = useState({ name: '', phone: '', location: '', outcome: 'interested', notes: '' });
  return (
    <div className="card">
      <h2 style={{ marginBottom: 14 }}>Log outreach contact</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <input style={inputStyle} placeholder="Contact name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input style={inputStyle} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input style={inputStyle} placeholder="Location / area" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <select style={inputStyle} value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
          <option value="accepted_christ">Accepted Christ</option>
          <option value="interested">Interested</option>
          <option value="not_interested">Not interested</option>
          <option value="already_member">Already a member</option>
          <option value="other">Other</option>
        </select>
        <div style={{ gridColumn: '1 / -1' }}>
          <input style={inputStyle} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <button
        className="btn btn-primary"
        style={{ marginBottom: 20 }}
        disabled={!form.name}
        onClick={() => {
          onSubmit(form);
          setForm({ name: '', phone: '', location: '', outcome: 'interested', notes: '' });
        }}
      >
        Log contact
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {contacts.length === 0 && <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No contacts logged yet.</p>}
        {contacts.map((c) => {
          const isUnsynced = String(c._id || c.clientEventId).startsWith('local-') || !c._id;
          return (
            <div key={c.clientEventId || c._id} style={{ borderTop: '1px solid var(--line)', paddingTop: 8, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>{c.name || 'Unnamed contact'}{c.location && ` · ${c.location}`}</span>
                <span className={`badge ${OUTCOME_BADGE[c.outcome] || 'new'}`}>{c.outcome?.replace('_', ' ')}</span>
              </div>
              {c.notes && <p style={{ marginTop: 4, color: 'var(--ink-500)', fontSize: 13 }}>{c.notes}</p>}
              <div style={{ marginTop: 6 }}>
                {c.convertedMember ? (
                  <span className="badge good">Converted to member</span>
                ) : isUnsynced ? (
                  <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Still syncing — convert once online</span>
                ) : (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 10px', fontSize: 12 }}
                    onClick={() => onConvert(c)}
                  >
                    Convert to member
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttendancePanel({ roster, attendance, onMark }) {
  const presentIds = new Set(attendance.map((a) => a.member));
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2>Meeting attendance</h2>
        <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>{attendance.length} present today</span>
      </div>
      {roster.length === 0 && (
        <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>Add members to the roster first.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {roster.map((m) => {
          const done = presentIds.has(m._id);
          return (
            <div
              key={m._id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--line)',
                paddingTop: 8,
                fontSize: 14,
              }}
            >
              <span>{m.firstName} {m.lastName}</span>
              <button
                onClick={() => !done && onMark(m._id)}
                disabled={done}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: done ? 'none' : '1.5px solid var(--line)',
                  background: done ? '#5fc48b' : 'var(--white)',
                  color: '#fff',
                  cursor: done ? 'default' : 'pointer',
                }}
                aria-label={done ? 'Present' : `Mark ${m.firstName} present`}
              >
                {done ? '✓' : ''}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
