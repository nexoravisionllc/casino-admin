import { useState } from 'react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from './Modal.jsx';
import { Alert, Field, Spinner } from './ui.jsx';
import { PercentIcon } from './Icons.jsx';

// Change the FortuneGate agent RTP (win_ratio) via POST /api/fortunegate/rtp.
export default function RtpModal({ current, onClose, onSaved }) {
  const { token } = useAuth();
  const [value, setValue] = useState(current != null ? String(Number(current)) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = Number(value);
    if (value === '' || Number.isNaN(v)) return setError('Enter a number.');
    if (v < 0 || v > 100) return setError('Win ratio must be between 0 and 100.');
    setBusy(true);
    setError('');
    try {
      await apiRequest('/fortunegate/rtp', { method: 'POST', token, body: { winRatio: v } });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Fortune Gate RTP" subtitle={`Current win ratio: ${Number(current ?? 0)}%`} icon={PercentIcon}
      onClose={onClose} onSubmit={submit}
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy && <Spinner />}{busy ? 'Requesting…' : 'Request change'}</button>
      </>}
    >
      <Field label="Win ratio (RTP %)" hint="Allowed range: 0 – 100">
        <input className="input" type="number" step="0.1" min="0" max="100" value={value}
          onChange={(e) => setValue(e.target.value)} autoFocus placeholder="e.g. 85" />
      </Field>
      {error && <Alert>{error}</Alert>}
    </Modal>
  );
}
