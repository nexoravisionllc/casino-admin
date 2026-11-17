import { useState } from 'react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { money } from '../lib/format.js';
import Modal from './Modal.jsx';
import { Alert, Field, Spinner } from './ui.jsx';
import { WalletIcon } from './Icons.jsx';

// Pay (add) or collect (subtract) a member's balance or points.
export function AdjustModal({ user, field: initialField, mode: initialMode, onClose, onSaved }) {
  const { token } = useAuth();
  const [field, setField] = useState(initialField);
  const [mode, setMode] = useState(initialMode);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isBalance = field === 'balance';
  const unit = isBalance ? '$' : 'P';
  const current = Number(isBalance ? user.balance : user.point);
  const v = Number(amount);
  const valid = amount !== '' && Number.isFinite(v) && v > 0;
  const after = valid ? (mode === 'pay' ? current + v : current - v) : null;
  const fmt = (n) => (isBalance ? `$${money(n)}` : `${money(n)} P`);

  const submit = async () => {
    setError('');
    if (!valid) return setError('Enter an amount greater than zero.');
    if (mode === 'collect' && v > current) return setError(`Can't collect more than the current ${field} (${fmt(current)}).`);
    setBusy(true);
    try {
      onSaved(await apiRequest(`/users/${user.uid}/adjust`, { method: 'POST', token, body: { field, mode, amount: v } }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const verb = mode === 'pay' ? 'Pay' : 'Collect';
  return (
    <Modal
      title={`${verb} ${isBalance ? 'balance' : 'points'}`} subtitle={`${user.name} (@${user.loginId})`}
      icon={WalletIcon} tone={mode === 'collect' ? 'warn' : undefined}
      onClose={onClose} onSubmit={submit}
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className={`btn ${mode === 'pay' ? 'btn--primary' : 'btn--warn-soft'}`} disabled={busy}>
          {busy && <Spinner />}{busy ? 'Saving…' : `${verb}${valid ? ` ${fmt(v)}` : ''}`}
        </button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="seg seg--block">
          <button type="button" className={`seg__btn ${isBalance ? 'is-active' : ''}`} onClick={() => setField('balance')}>Balance</button>
          <button type="button" className={`seg__btn ${!isBalance ? 'is-active' : ''}`} onClick={() => setField('point')}>Points</button>
        </div>
        <div className="seg seg--block">
          <button type="button" className={`seg__btn ${mode === 'pay' ? 'is-active' : ''}`} onClick={() => setMode('pay')}>Pay</button>
          <button type="button" className={`seg__btn ${mode === 'collect' ? 'is-active' : ''}`} onClick={() => setMode('collect')}>Collect</button>
        </div>
      </div>
      <Field label={`Amount (${unit})`}>
        <input className="input input--lg" type="number" step="0.01" min="0" value={amount}
          onChange={(e) => setAmount(e.target.value)} autoFocus placeholder="0.00" />
      </Field>
      <div className="callout">
        <span>Current {isBalance ? 'balance' : 'points'}</span><b>{fmt(current)}</b>
      </div>
      {after != null && (
        <div className="callout">
          <span>After {mode === 'pay' ? 'payment' : 'collection'}</span>
          <b className={after < 0 ? 'neg' : ''}>{fmt(after)}</b>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
    </Modal>
  );
}
