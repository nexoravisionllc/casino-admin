import { useState } from 'react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const RATES = [
  { key: 'casinoRate', label: 'Casino Rate' },
  { key: 'slotRate', label: 'Slot Rate' },
  { key: 'sportsRate', label: 'Sport Rate' },
];

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="amodal-overlay" onMouseDown={onClose}>
      <div className={`amodal ${wide ? 'amodal--wide' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="amodal__head">
          <h3>{title}</h3>
          <button className="amodal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="amodal__body">{children}</div>
      </div>
    </div>
  );
}

// Edit a single rate. The value must stay within [min, max].
export function RateEditModal({ agent, rateKey, rateLabel, min, max, onClose, onSaved }) {
  const { token } = useAuth();
  const [value, setValue] = useState(String(Number(agent[rateKey] ?? 0)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const v = Number(value);
    if (Number.isNaN(v)) return setError('Enter a number.');
    if (v > max) return setError(`Value cannot be higher than the master's rate (${max}%).`);
    if (v < min) return setError(`Value cannot be lower than a sub-agent's rate (${min}%).`);
    setBusy(true);
    setError('');
    try {
      const body = {
        casinoRate: Number(agent.casinoRate),
        slotRate: Number(agent.slotRate),
        sportsRate: Number(agent.sportsRate),
        [rateKey]: v,
      };
      const updated = await apiRequest(`/agents/${agent.uid}/rates`, { method: 'PUT', body, token });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Edit ${rateLabel}`} onClose={onClose}>
      <label className="afield">
        <span className="afield__label">{rateLabel} (%)</span>
        <input className="afield__input" type="number" step="0.1" value={value}
          onChange={(e) => setValue(e.target.value)} autoFocus />
        <span className="afield__hint">Allowed range: {min}% – {max}%</span>
      </label>
      {error && <p className="amodal__error">{error}</p>}
      <div className="amodal__actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

// Create a sub agent or sub user under `parent`. The Agent kind (default) shows a
// referral field and the three rate fields; the User kind hides both.
export function CreateSubModal({ parent, onClose, onCreated }) {
  const { token } = useAuth();
  const caps = {
    casinoRate: parent.role === 1 ? 100 : Number(parent.casinoRate),
    slotRate: parent.role === 1 ? 100 : Number(parent.slotRate),
    sportsRate: parent.role === 1 ? 100 : Number(parent.sportsRate),
  };
  const [kind, setKind] = useState('agent'); // 'agent' | 'user'
  const isAgent = kind === 'agent';
  const [form, setForm] = useState({
    name: '', loginId: '', password: '', email: '',
    bankName: '', bankAccount: '', bankMaster: '', referralId: '',
    casinoRate: '', slotRate: '', sportsRate: '',
  });
  const [idState, setIdState] = useState(null); // null | 'ok' | 'taken' (agent only)
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Availability check only applies to agents (Partners table); users are separate.
  const checkId = async () => {
    if (!form.loginId.trim()) return setIdState(null);
    try {
      const r = await apiRequest(`/agents/check-id?loginId=${encodeURIComponent(form.loginId.trim())}`, { token });
      setIdState(r.available ? 'ok' : 'taken');
    } catch { setIdState(null); }
  };

  const submit = async () => {
    setError('');
    if (!form.name.trim() || !form.loginId.trim() || !form.password) return setError('Name, ID and password are required.');
    if (isAgent && idState === 'taken') return setError(`The ID "${form.loginId}" is already taken.`);
    if (isAgent) {
      for (const { key, label } of [
        { key: 'casinoRate', label: 'Casino' }, { key: 'slotRate', label: 'Slot' }, { key: 'sportsRate', label: 'Sport' }]) {
        const v = Number(form[key] || 0);
        if (v < 0) return setError(`${label} rate cannot be negative.`);
        if (v > caps[key]) return setError(`${label} rate can't exceed ${caps[key]}%.`);
      }
    }
    const common = {
      parentId: parent.uid,
      name: form.name.trim(), loginId: form.loginId.trim(), password: form.password,
      email: form.email || null, bankName: form.bankName || null,
      bankAccount: form.bankAccount || null, bankMaster: form.bankMaster || null,
    };
    setBusy(true);
    try {
      const created = isAgent
        ? await apiRequest('/agents', {
            method: 'POST', token,
            body: {
              ...common,
              referralId: form.referralId.trim() || null,
              casinoRate: Number(form.casinoRate || 0), slotRate: Number(form.slotRate || 0), sportsRate: Number(form.sportsRate || 0),
            },
          })
        : await apiRequest('/users', { method: 'POST', token, body: common });
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Create Sub under ${parent.name}`} onClose={onClose} wide>
      <div className="agrid">
        <div className="afield afull">
          <span className="afield__label">Type</span>
          <div className="akind">
            <button type="button" className={`akind__opt ${isAgent ? 'is-on' : ''}`} onClick={() => setKind('agent')}>Agent</button>
            <button type="button" className={`akind__opt ${!isAgent ? 'is-on' : ''}`} onClick={() => setKind('user')}>User</button>
          </div>
        </div>
        <label className="afield"><span className="afield__label">Name</span>
          <input className="afield__input" value={form.name} onChange={set('name')} /></label>
        <label className="afield"><span className="afield__label">ID</span>
          <input className="afield__input" autoComplete="off" value={form.loginId} onChange={(e) => { set('loginId')(e); setIdState(null); }} onBlur={isAgent ? checkId : undefined} />
          {isAgent && idState === 'ok' && <span className="afield__hint afield__hint--ok">ID is available.</span>}
          {isAgent && idState === 'taken' && <span className="afield__hint afield__hint--bad">ID is already taken.</span>}
        </label>
        <label className="afield"><span className="afield__label">Password</span>
          <input className="afield__input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} /></label>
        <label className="afield"><span className="afield__label">Email</span>
          <input className="afield__input" type="email" value={form.email} onChange={set('email')} /></label>
        <label className="afield"><span className="afield__label">Bank</span>
          <input className="afield__input" value={form.bankName} onChange={set('bankName')} /></label>
        <label className="afield"><span className="afield__label">Bank Account</span>
          <input className="afield__input" value={form.bankAccount} onChange={set('bankAccount')} /></label>
        <label className="afield"><span className="afield__label">Depositor</span>
          <input className="afield__input" value={form.bankMaster} onChange={set('bankMaster')} /></label>
        {isAgent && (
          <label className="afield"><span className="afield__label">Referral ID</span>
            <input className="afield__input" value={form.referralId} onChange={set('referralId')} /></label>
        )}
        {isAgent && (
          <>
            <label className="afield"><span className="afield__label">Casino Rate (max {caps.casinoRate}%)</span>
              <input className="afield__input" type="number" step="0.1" value={form.casinoRate} onChange={set('casinoRate')} /></label>
            <label className="afield"><span className="afield__label">Slot Rate (max {caps.slotRate}%)</span>
              <input className="afield__input" type="number" step="0.1" value={form.slotRate} onChange={set('slotRate')} /></label>
            <label className="afield"><span className="afield__label">Sport Rate (max {caps.sportsRate}%)</span>
              <input className="afield__input" type="number" step="0.1" value={form.sportsRate} onChange={set('sportsRate')} /></label>
          </>
        )}
      </div>
      {error && <p className="amodal__error">{error}</p>}
      <div className="amodal__actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
      </div>
    </Modal>
  );
}

// Edit an agent's referral code (blank clears it).
export function ReferralEditModal({ agent, onClose, onSaved }) {
  const { token } = useAuth();
  const [value, setValue] = useState(agent.referralId ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest(`/agents/${agent.uid}/referral`, {
        method: 'PUT', token, body: { referralId: value.trim() || null },
      });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Edit Referral ID – ${agent.name}`} onClose={onClose}>
      <label className="afield">
        <span className="afield__label">Referral ID</span>
        <input className="afield__input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        <span className="afield__hint">Users enter this code when signing up to attach under this agent. Leave blank to clear.</span>
      </label>
      {error && <p className="amodal__error">{error}</p>}
      <div className="amodal__actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

export function ChangePasswordModal({ agent, onClose, onDone }) {
  const { token } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (!pw) return setError('Enter a password.');
    if (pw !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await apiRequest(`/agents/${agent.uid}/password`, { method: 'POST', body: { password: pw }, token });
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Change Password – ${agent.name}`} onClose={onClose}>
      <label className="afield"><span className="afield__label">New Password</span>
        <input className="afield__input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></label>
      <label className="afield"><span className="afield__label">Confirm Password</span>
        <input className="afield__input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      {error && <p className="amodal__error">{error}</p>}
      <div className="amodal__actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Change'}</button>
      </div>
    </Modal>
  );
}

export function ConfirmDeleteModal({ agent, onClose, onDone }) {
  const { token } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const del = async () => {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/agents/${agent.uid}`, { method: 'DELETE', token });
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <Modal title="Delete Agent" onClose={onClose}>
      <p className="amodal__text">Delete <strong>{agent.name} ({agent.loginId})</strong>? This cannot be undone.</p>
      {error && <p className="amodal__error">{error}</p>}
      <div className="amodal__actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={del} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button>
      </div>
    </Modal>
  );
}

export { RATES };
