import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DEMO_TITLE, useAuth } from '../context/AuthContext.jsx';
import { useStats } from '../context/StatsContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useClickOutside } from '../hooks/useClickOutside.js';
import { roleName, usd } from '../lib/format.js';
import Logo from './Logo.jsx';
import RtpModal from './RtpModal.jsx';
import {
  MenuIcon, GateIcon, EditIcon, UserClockIcon, DepositIcon, WithdrawIcon,
  ChevronDownIcon, LogoutIcon, MoonIcon, SunIcon,
} from './Icons.jsx';

function UserMenu({ partner, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { theme, setTheme } = useTheme();
  const { pathname } = useLocation();
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);
  useEffect(() => { setOpen(false); }, [pathname]);

  const initial = (partner?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className={`umenu ${open ? 'is-open' : ''}`} ref={ref}>
      <button type="button" className="umenu__trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <span className="umenu__avatar">{initial}</span>
        <span className="umenu__who-inline">
          <span className="umenu__name">{partner?.name}</span>
          <span className="umenu__role">{roleName(partner?.role)}</span>
        </span>
        <ChevronDownIcon width={16} height={16} className="umenu__chev" />
      </button>

      {open && (
        <div className="umenu__panel" role="menu">
          <div className="umenu__head">
            <span className="umenu__avatar umenu__avatar--lg">{initial}</span>
            <div className="umenu__who">
              <strong>{partner?.name}</strong>
              <span>@{partner?.loginId} · {roleName(partner?.role)}</span>
            </div>
          </div>
          <p className="umenu__section">Appearance</p>
          <div className="umenu__theme">
            <div className="seg seg--block">
              <button type="button" className={`seg__btn ${theme === 'dark' ? 'is-active' : ''}`} onClick={() => setTheme('dark')}>
                <MoonIcon width={14} height={14} /> Dark
              </button>
              <button type="button" className={`seg__btn ${theme === 'light' ? 'is-active' : ''}`} onClick={() => setTheme('light')}>
                <SunIcon width={14} height={14} /> Light
              </button>
            </div>
          </div>
          <div className="umenu__sep" />
          <button type="button" role="menuitem" className="umenu__item umenu__item--danger" onClick={() => { setOpen(false); onLogout(); }}>
            <LogoutIcon width={17} height={17} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Counter({ to, Icon, label, count, tone }) {
  const n = Number(count ?? 0);
  return (
    <Link to={to} className="icon-btn" title={`${label}: ${n}`} aria-label={`${label}: ${n}`}>
      <Icon width={18} height={18} />
      {n > 0 && <span className={`icon-btn__count ${tone ? `icon-btn__count--${tone}` : ''}`}>{n > 99 ? '99+' : n}</span>}
    </Link>
  );
}

export default function Header({ onToggleSidebar }) {
  const { partner, logout, readOnly } = useAuth();
  const { stats, refresh } = useStats();
  const navigate = useNavigate();
  const [rtpOpen, setRtpOpen] = useState(false);
  const s = stats ?? {};

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header__left">
        <button className="icon-btn icon-btn--plain" aria-label="Toggle menu" onClick={onToggleSidebar}>
          <MenuIcon />
        </button>
        <Link to="/" aria-label="Dashboard"><Logo /></Link>
      </div>

      <div className="header__right">
        <div className="fgate" title="Fortune Gate agent balance and RTP">
          <span className="fgate__item">
            <GateIcon width={16} height={16} className="fgate__ico" />
            <span className="fgate__label">Fortune Gate</span>
            {stats ? usd(s.fortuneGate) : '—'}
          </span>
          <span className="fgate__divider" />
          <span className="fgate__item fgate__rtp-wrap">
            <span className="fgate__label">RTP</span>
            <span className="fgate__rtp">{stats ? `${Number(s.fortuneRtp ?? 0)}%` : '—'}</span>
          </span>
          <button className="icon-btn icon-btn--plain icon-btn--sm" onClick={() => setRtpOpen(true)} aria-label="Change Fortune RTP" disabled={readOnly} title={readOnly ? DEMO_TITLE : 'Change RTP'}>
            <EditIcon width={14} height={14} />
          </button>
        </div>

        <span className="header__counters">
          <Counter to="/members/waited" Icon={UserClockIcon} label="Members waiting approval" count={s.waitedUsers} />
          <Counter to="/money/deposit" Icon={DepositIcon} label="Pending deposits" count={s.deposit} tone="warn" />
          <Counter to="/money/withdraw" Icon={WithdrawIcon} label="Pending withdrawals" count={s.withdraw} tone="warn" />
        </span>

        <UserMenu partner={partner} onLogout={handleLogout} />
      </div>

      {rtpOpen && <RtpModal current={s.fortuneRtp} onClose={() => setRtpOpen(false)} onSaved={refresh} />}
    </header>
  );
}
