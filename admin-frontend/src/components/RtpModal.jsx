import { useState } from 'react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

// Change the FortuneGate agent RTP (win_ratio) via POST /api/fortunegate/rtp.
// The header value refreshes on its own from the 5-second poller after success.
export default function RtpModal({ current, onClose }) {
  const { token } = useAuth();
  const [value, setValue] = useState(current != null ? String(Number(current)) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async () => {
    const v = Number(value);
    if (value === '' || Number.isNaN(v)) return setError('Enter a number.');
    if (v < 0 || v > 100) return setError('Win ratio must be between 0 and 100.');
    setBusy(true);
    setError('');
    try {
      await apiRequest('/fortunegate/rtp', { method: 'POST', token, body: { winRatio: v } });
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="amodal-overlay" onMouseDown={onClose}>
      <div className="amodal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="amodal__head">
          <h3>Fortune RTP Request</h3>
          <button className="amodal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="amodal__body">
          <label className="afield">
            <span className="afield__label">Win Ratio (RTP %)</span>
            <input className="afield__input" type="number" step="0.1" value={value}
              onChange={(e) => setValue(e.target.value)} autoFocus placeholder="e.g. 85" />
            <span className="afield__hint">Allowed: 0 – 100</span>
          </label>
          {error && <p className="amodal__error">{error}</p>}
          <div className="amodal__actions">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={request} disabled={busy}>
              {busy ? 'Requesting…' : 'Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
