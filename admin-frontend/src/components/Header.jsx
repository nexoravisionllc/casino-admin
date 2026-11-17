import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';
import RtpModal from './RtpModal.jsx';
import {
  GateIcon, DollarIcon, PointIcon, UsersIcon, ClockIcon, WifiIcon,
  DepositIcon, WithdrawIcon, AvatarIcon, LogoutIcon, BarChartIcon,
} from './Icons.jsx';

const usd = (v) => '$' + Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pts = (v) => Number(v ?? 0).toLocaleString('en-US') + ' P';
const num = (v) => Number(v ?? 0).toLocaleString('en-US');

// Dashboard header built from the gold1 reference: pill-shaped stat chips.
// Removed vs. the reference: Balance, Net P/L, HonorLink, and the language icon.
// SlotCity -> Fortune Gate.
export default function Header({ stats }) {
  const { partner, logout } = useAuth();
  const navigate = useNavigate();
  const s = stats ?? {};
  const [rtpOpen, setRtpOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Fortune Gate stands on its own; the rest are shown in top-to-bottom pairs.
  const fortune = { key: 'gate', tone: 'green', Icon: GateIcon, label: 'Fortune Gate', value: usd(s.fortuneGate) };
  const rest = [
    { key: 'ubal', tone: 'blue', Icon: DollarIcon, label: 'User Balance', value: usd(s.userBalance) },
    { key: 'upts', tone: 'blue', Icon: PointIcon, label: 'User Points', value: pts(s.userPoints) },
    { key: 'pbal', tone: 'blue', Icon: DollarIcon, label: 'Partner Balance', value: usd(s.partnerBalance) },
    { key: 'ppts', tone: 'blue', Icon: PointIcon, label: 'Partner Points', value: pts(s.partnerPoints) },
    { key: 'wait', tone: 'red', Icon: ClockIcon, label: 'Waited Users', value: num(s.waitedUsers) },
    { key: 'conn', tone: 'green', Icon: WifiIcon, label: 'Connected Users', value: num(s.connectedUsers) },
    { key: 'dep', tone: 'blue', Icon: DepositIcon, label: 'Deposit', value: num(s.deposit) },
    { key: 'wd', tone: 'red', Icon: WithdrawIcon, label: 'Withdraw', value: num(s.withdraw) },
  ];

  const renderPill = ({ key, tone, Icon, label, value }) => (
    <div className={`pill pill--${tone}`} key={key}>
      <Icon width={15} height={15} className="pill__icon" />
      <span className="pill__label">{label}</span>
      <span className="pill__value">{value}</span>
    </div>
  );

  return (
    <header className="dash-header">
      <div className="dash-header__brand"><Logo light /></div>

      <div className="dash-header__pills">
        {/* Fortune Gate on top, Fortune RTP below it (first column), then the rest. */}
        <div className="pill-grid">
          {renderPill(fortune)}
          <div className="pill pill--green pill--rtp" key="rtp">
            <BarChartIcon width={15} height={15} className="pill__icon" />
            <span className="pill__label">Fortune RTP</span>
            <span className="pill__value">{Number(s.fortuneRtp ?? 0)} %</span>
            <button className="pill__edit" onClick={() => setRtpOpen(true)} aria-label="Edit RTP">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
          </div>
          {rest.map(renderPill)}
        </div>
      </div>

      <div className="dash-header__user">
        <span className="dash-header__avatar"><AvatarIcon width={18} height={18} /></span>
        <span className="dash-header__name">{partner?.name}</span>
        <button className="dash-header__logout" onClick={handleLogout} aria-label="Logout">
          <LogoutIcon width={18} height={18} />
        </button>
      </div>

      {rtpOpen && <RtpModal current={s.fortuneRtp} onClose={() => setRtpOpen(false)} />}
    </header>
  );
}
