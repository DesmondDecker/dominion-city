import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDepartment } from '../lib/departments';
import { ensureChurchId } from '../lib/church';
import BranchPicker from '../components/BranchPicker';
import StaffPicker from '../components/StaffPicker';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
};

export default function CreateDepartment() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    scope: 'branch',
    branch: '',
    trackOutreachContacts: false,
    headUser: '',
    meetingDay: '',
    meetingTime: '',
  });

  async function handleSubmit() {
    const church = await ensureChurchId();
    await createDepartment({
      ...(church ? { church } : {}),
      name: form.name,
      description: form.description,
      scope: form.scope,
      branch: form.scope === 'national' ? null : form.branch,
      trackOutreachContacts: form.trackOutreachContacts,
      headUser: form.headUser || undefined,
      defaultMeeting: form.meetingDay ? { dayOfWeek: form.meetingDay, time: form.meetingTime } : undefined,
    });
    navigate('/departments');
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>New department</h1>
      <p style={{ color: 'var(--ink-500)', marginTop: 6, marginBottom: 24 }}>
        Set up a department — roster, duty scheduling, and attendance all follow from here.
      </p>

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Field label="Name">
            <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Choir, Evangelism & Mobilisation" />
          </Field>
          <Field label="Scope">
            <select style={inputStyle} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
              <option value="branch">This branch only</option>
              <option value="national">National (all branches)</option>
            </select>
          </Field>
          {form.scope !== 'national' && (
            <Field label="Branch">
              <BranchPicker value={form.branch} onChange={(branch) => setForm({ ...form, branch })} />
            </Field>
          )}
          <Field label="Department head">
            <StaffPicker value={form.headUser} onChange={(headUser) => setForm({ ...form, headUser })} />
          </Field>
          <Field label="Meeting day (optional)">
            <input style={inputStyle} placeholder="e.g. Wednesday" value={form.meetingDay} onChange={(e) => setForm({ ...form, meetingDay: e.target.value })} />
          </Field>
          <Field label="Meeting time (optional)">
            <input style={inputStyle} placeholder="e.g. 6:00pm" value={form.meetingTime} onChange={(e) => setForm({ ...form, meetingTime: e.target.value })} />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Description">
              <input style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-700)', marginBottom: 18 }}>
          <input
            type="checkbox"
            checked={form.trackOutreachContacts}
            onChange={(e) => setForm({ ...form, trackOutreachContacts: e.target.checked })}
          />
          This department tracks outreach contacts (soul-winning records)
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!form.name || (form.scope !== 'national' && !form.branch)}
          >
            Create department
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/departments')}>
            Cancel
          </button>
        </div>
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
