import { useState } from 'react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from './Modal.jsx';
import { Alert, Field, Spinner } from './ui.jsx';
import { EyeIcon, EyeOffIcon, KeyIcon, LinkIcon, PercentIcon, TrashIcon, UserPlusIcon } from './Icons.jsx';

export const RATE_LABELS = { casinoRate: 'Casino rate', slotRate: 'Slot rate', sportsRate: 'Sports rate' };

/** Allowed range for an agent's rate: [highest child rate, parent rate]. */
export function rateBounds(agents, agent, rateKey) {
  const parent = agents.find((r) => r.uid === agent.partnerId);
  const max = !parent || parent.role === 1 ? 100 : Number(parent[rateKey]);
  const children = agents.filter((r) => r.partnerId === agent.uid);
  const min = children.length ? Math.max(...children.map((c) => Number(c[rateKey]))) : 0;
  return { min, max };
}

const Footer = ({ onClose, busy, label, busyLabel, danger }) => (
  <>
    <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
    <button type="submit" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} disabled={busy}>
      {busy && <Spinner />}{busy ? busyLabel : label}
    </button>
  </>
);

// Edit a single rate. The value must stay within [min, max].
export function RateEditModal({ agent, rateKey, min, max, onClose, onSaved }) {
  const { token } = useAuth();
  const label = RATE_LABELS[rateKey];
  const [value, setValue] = useState(String(Number(agent[rateKey] ?? 0)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const v = Number(value);
    if (value === '' || Number.isNaN(v)) return setError('Enter a number.');
    if (v > max) return setError(`Can't be higher than the parent's rate (${max}%).`);
    if (v < min) return setError(`Can't be lower than a sub-agent's rate (${min}%).`);
    setBusy(true);
    setError('');
    try {
      const body = {
        casinoRate: Number(agent.casinoRate),
        slotRate: Number(agent.slotRate),
        sportsRate: Number(agent.sportsRate),
        [rateKey]: v,
      };
      onSaved(await apiRequest(`/agents/${agent.uid}/rates`, { method: 'PUT', body, token }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Edit ${label.toLowerCase()}`} subtitle={`${agent.name} (@${agent.loginId})`} icon={PercentIcon}
      onClose={onClose} onSubmit={save} footer={<Footer onClose={onClose} busy={busy} label="Save" busyLabel="Saving…" />}>
      <Field label={`${label} (%)`} hint={`Allowed range: ${min}% – ${max}%`}>
        <input className="input" type="number" step="0.1" min={min} max={max} value={value}
          onChange={(e) => setValue(e.target.value)} autoFocus />
      </Field>
      {error && <Alert>{error}</Alert>}
    </Modal>
  );
}

// Create a sub agent or member under `parent`.
export function CreateSubModal({ parent, defaultKind = 'agent', onClose, onCreated }) {
  const { token } = useAuth();
  const caps = {
    casinoRate: parent.role === 1 ? 100 : Number(parent.casinoRate),
    slotRate: parent.role === 1 ? 100 : Number(parent.slotRate),
    sportsRate: parent.role === 1 ? 100 : Number(parent.sportsRate),
  };
  const [kind, setKind] = useState(defaultKind);
  const isAgent = kind === 'agent';
  const [form, setForm] = useState({
    name: '', loginId: '', password: '', email: '',
    bankName: '', bankAccount: '', bankMaster: '', referralId: '',
    casinoRate: '', slotRate: '', sportsRate: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [idState, setIdState] = useState(null); // null | 'ok' | 'taken'
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Availability check only applies to agents (Partners table).
  const checkId = async () => {
    if (!isAgent || !form.loginId.trim()) return setIdState(null);
    try {
      const r = await apiRequest(`/agents/check-id?loginId=${encodeURIComponent(form.loginId.trim())}`, { token });
      setIdState(r.available ? 'ok' : 'taken');
    } catch { setIdState(null); }
  };

  const submit = async () => {
    setError('');
    if (!form.name.trim() || !form.loginId.trim() || !form.password) return setError('Name, login ID and password are required.');
    if (isAgent && idState === 'taken') return setError(`The ID "${form.loginId}" is already taken.`);
    if (isAgent) {
      for (const key of ['casinoRate', 'slotRate', 'sportsRate']) {
        const v = Number(form[key] || 0);
        if (Number.isNaN(v) || v < 0) return setError(`${RATE_LABELS[key]} must be a positive number.`);
        if (v > caps[key]) return setError(`${RATE_LABELS[key]} can't exceed ${caps[key]}%.`);
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
      onCreated(created, kind);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isAgent ? 'Create sub-agent' : 'Create member'} subtitle={`Under ${parent.name} (@${parent.loginId})`}
      icon={UserPlusIcon} size="lg" onClose={onClose} onSubmit={submit}
      footer={<Footer onClose={onClose} busy={busy} label={isAgent ? 'Create agent' : 'Create member'} busyLabel="Creating…" />}
    >
      <div className="seg seg--block">
        <button type="button" className={`seg__btn ${isAgent ? 'is-active' : ''}`} onClick={() => setKind('agent')}>Agent</button>
        <button type="button" className={`seg__btn ${!isAgent ? 'is-active' : ''}`} onClick={() => { setKind('user'); setIdState(null); }}>Member</button>
      </div>
      <div className="form-grid">
        <p className="form-section">Account</p>
        <Field label="Name"><input className="input" value={form.name} onChange={set('name')} autoFocus /></Field>
        <Field
          label="Login ID"
          hint={idState === 'ok' ? 'ID is available.' : idState === 'taken' ? 'ID is already taken.' : undefined}
          hintTone={idState === 'ok' ? 'ok' : idState === 'taken' ? 'bad' : undefined}
        >
          <input className="input" autoComplete="off" value={form.loginId} onChange={(e) => { set('loginId')(e); setIdState(null); }} onBlur={checkId} />
        </Field>
        <Field label="Password">
          <div className="field__pw">
            <input className="input" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={set('password')} />
            <button type="button" className="field__eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <EyeOffIcon width={17} height={17} /> : <EyeIcon width={17} height={17} />}
            </button>
          </div>
        </Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={set('email')} placeholder="Optional" /></Field>

        <p className="form-section">Bank</p>
        <Field label="Bank name"><input className="input" value={form.bankName} onChange={set('bankName')} /></Field>
        <Field label="Account number"><input className="input" value={form.bankAccount} onChange={set('bankAccount')} /></Field>
        <Field label="Depositor name" full={!isAgent}><input className="input" value={form.bankMaster} onChange={set('bankMaster')} /></Field>
        {isAgent && (
          <Field label="Referral ID" hint="Members enter this code at sign-up.">
            <input className="input" value={form.referralId} onChange={set('referralId')} placeholder="Optional" />
          </Field>
        )}

        {isAgent && (
          <>
            <p className="form-section">Commission rates</p>
            <div className="field--full" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {['casinoRate', 'slotRate', 'sportsRate'].map((k) => (
                <Field key={k} label={RATE_LABELS[k]} hint={`Max ${caps[k]}%`}>
                  <input className="input" type="number" step="0.1" min="0" max={caps[k]} value={form[k]} onChange={set(k)} placeholder="0" />
                </Field>
              ))}
            </div>
          </>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
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
      onSaved(await apiRequest(`/agents/${agent.uid}/referral`, { method: 'PUT', token, body: { referralId: value.trim() || null } }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Referral ID" subtitle={`${agent.name} (@${agent.loginId})`} icon={LinkIcon}
      onClose={onClose} onSubmit={save} footer={<Footer onClose={onClose} busy={busy} label="Save" busyLabel="Saving…" />}>
      <Field label="Referral ID" hint="Members enter this code when signing up to join under this agent. Leave blank to clear.">
        <input className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </Field>
      {error && <Alert>{error}</Alert>}
    </Modal>
  );
}

export function ChangePasswordModal({ agent, onClose, onDone }) {
  const { token } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (!pw) return setError('Enter a new password.');
    if (pw !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await apiRequest(`/agents/${agent.uid}/password`, { method: 'POST', body: { password: pw }, token });
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <Modal title="Change password" subtitle={`${agent.name} (@${agent.loginId})`} icon={KeyIcon}
      onClose={onClose} onSubmit={submit} footer={<Footer onClose={onClose} busy={busy} label="Change password" busyLabel="Saving…" />}>
      <Field label="New password">
        <div className="field__pw">
          <input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          <button type="button" className="field__eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOffIcon width={17} height={17} /> : <EyeIcon width={17} height={17} />}
          </button>
        </div>
      </Field>
      <Field label="Confirm password"
        hint={confirm && pw !== confirm ? 'Passwords do not match.' : undefined} hintTone="bad">
        <input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {error && <Alert>{error}</Alert>}
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
    <Modal title="Delete agent" icon={TrashIcon} tone="danger" onClose={onClose} onSubmit={del}
      footer={<Footer onClose={onClose} busy={busy} label="Delete agent" busyLabel="Deleting…" danger />}>
      <p className="modal__text">
        Delete <strong>{agent.name} (@{agent.loginId})</strong>? This can’t be undone.
      </p>
      {error && <Alert>{error}</Alert>}
    </Modal>
  );
}
