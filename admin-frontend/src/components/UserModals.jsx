import { useState } from 'react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

// Human title for each field/mode combination.
const TITLES = {
  'balance:pay': 'Balance Payment',
  'balance:collect': 'Balance Collect',
  'point:pay': 'Point Payment',
  'point:collect': 'Point Collect',
};

function Modal({ title, onClose, children }) {
  return (
    <div className="amodal-overlay" onMouseDown={onClose}>
      <div className="amodal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="amodal__head">
          <h3>{title}</h3>
          <button className="amodal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="amodal__body">{children}</div>
      </div>
    </div>
  );
}

// Pay (add) or collect (subtract) a user's balance or point.
export function AdjustModal({ user, field, mode, onClose, onSaved }) {
  const { token } = useAuth();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const title = TITLES[`${field}:${mode}`] ?? 'Adjust';
  const unit = field === 'balance' ? '$' : 'P';
  const current = field === 'balance' ? user.balance : user.point;
  const verb = mode === 'pay' ? 'Add to' : 'Subtract from';

  const submit = async () => {
    setError('');
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return setError('Enter an amount greater than zero.');
    if (mode === 'collect' && v > Number(current))
      return setError(`Cannot collect more than the current ${field} (${Number(current).toLocaleString('en-US')}).`);
    setBusy(true);
    try {
      const updated = await apiRequest(`/users/${user.uid}/adjust`, {
        method: 'POST', token, body: { field, mode, amount: v },
      });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`${title} — ${user.name}`} onClose={onClose}>
      <p className="amodal__text">
        {verb} <strong>{user.name}</strong>’s {field}. Current {field}:{' '}
        <strong>{unit} {Number(current).toLocaleString('en-US')}</strong>
      </p>
      <label className="afield">
        <span className="afield__label">Amount ({unit})</span>
        <input
          className="afield__input" type="number" step="0.01" min="0" value={amount}
          onChange={(e) => setAmount(e.target.value)} autoFocus
        />
      </label>
      {error && <p className="amodal__error">{error}</p>}
      <div className="amodal__actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : mode === 'pay' ? 'Pay' : 'Collect'}
        </button>
      </div>
    </Modal>
  );
}
