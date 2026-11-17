import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api/client.js';

const svg = { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const WrenchIcon = () => (<svg {...svg}><path d="M14 7a4 4 0 01-5 5L4 17v3h3l5-5a4 4 0 005-5l-2 2-2-2 2-2a4 4 0 01-1 4z" /></svg>);
const MoneyIcon = () => (<svg {...svg}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>);
const GiftIcon = () => (<svg {...svg}><rect x="3" y="8" width="18" height="4" /><path d="M5 12v9h14v-9M12 8v13M12 8S9 3 6.5 5 8 8 12 8zM12 8s3-5 5.5-3S16 8 12 8z" /></svg>);
const PadIcon = () => (<svg {...svg}><rect x="2" y="7" width="20" height="10" rx="5" /><path d="M7 12h3M8.5 10.5v3" /><circle cx="16" cy="11" r="1" fill="currentColor" /><circle cx="18" cy="13" r="1" fill="currentColor" /></svg>);

const tabs = [
  { key: 'maintenance', label: 'Maintenance', Icon: WrenchIcon },
  { key: 'deposit', label: 'Deposit/Withdraw', Icon: MoneyIcon },
  { key: 'bonus', label: 'Bonus & Events', Icon: GiftIcon },
  { key: 'game', label: 'Game', Icon: PadIcon },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" />
    </button>
  );
}

export default function SettingPage() {
  const [tab, setTab] = useState('game');

  return (
    <section className="setting">
      <div className="setting__tabs">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`setting__tab ${tab === key ? 'is-active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="setting__body">
        {tab === 'game' ? <GameSetting /> : <Placeholder label={tabs.find((t) => t.key === tab)?.label} />}
      </div>
    </section>
  );
}

function Placeholder({ label }) {
  return <p className="setting__placeholder">{label} settings — coming soon.</p>;
}

// Game visibility toggles, backed by /api/gamesetting.
function GameSetting() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiRequest('/gamesetting', { token })
      .then((d) => { setRows(d ?? []); setError(''); })
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (row, next) => {
    // Optimistic update, then persist.
    setRows((rs) => rs.map((r) => (r.uid === row.uid ? { ...r, showEnable: next } : r)));
    try {
      await apiRequest(`/gamesetting/${row.uid}`, { method: 'PUT', token, body: { showEnable: next } });
    } catch (e) {
      setError(e.message);
      load(); // revert to server truth on failure
    }
  };

  return (
    <div className="setting__game">
      {error && <p className="dash__error">{error}</p>}
      {rows.map((r) => (
        <div className="setting__row" key={r.uid}>
          <span className="setting__label">{r.name} Show</span>
          <Toggle checked={r.showEnable} onChange={(next) => toggle(r, next)} />
        </div>
      ))}
    </div>
  );
}
