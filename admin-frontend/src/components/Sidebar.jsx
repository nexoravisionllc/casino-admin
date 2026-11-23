import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useStats } from '../context/StatsContext.jsx';
import { NAV } from './nav.js';
import { MoonIcon, SunIcon } from './Icons.jsx';

// Grouped navigation. `rail` = collapsed icon rail with hover flyouts.
export default function Sidebar({ rail, onNavigate }) {
  const { theme, setTheme } = useTheme();
  const { stats } = useStats();
  const { partner } = useAuth();
  const isTopAdmin = Number(partner?.role) === 1;

  return (
    <aside className={`sidebar ${rail ? 'sidebar--rail' : ''}`} aria-label="Main navigation">
      <nav className="sidebar__scroll">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="sidebar__section">{section}</p>
            <ul className="snav">
              {items.filter((item) => !item.adminOnly || isTopAdmin).map(({ to, label, Icon, end, count, tone }) => {
                const n = count ? Number(stats?.[count] ?? 0) : 0;
                return (
                  <li key={to}>
                    <NavLink
                      to={to} end={end} onClick={onNavigate}
                      className={({ isActive }) => `snav__item ${isActive ? 'is-active' : ''}`}
                    >
                      <Icon width={19} height={19} className="snav__ico" />
                      <span className="snav__text">{label}</span>
                      {n > 0 && <span className={`snav__count ${tone === 'warn' ? 'snav__count--warn' : ''}`}>{n > 99 ? '99+' : n}</span>}
                      <span className="snav__flyout">{label}{n > 0 ? ` (${n})` : ''}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="theme-switch">
          <button className={`theme-switch__btn ${theme === 'dark' ? 'is-active' : ''}`} onClick={() => setTheme('dark')} aria-label="Dark theme">
            <MoonIcon width={15} height={15} /> <span className="theme-switch__label">Dark</span>
          </button>
          <button className={`theme-switch__btn ${theme === 'light' ? 'is-active' : ''}`} onClick={() => setTheme('light')} aria-label="Light theme">
            <SunIcon width={15} height={15} /> <span className="theme-switch__label">Light</span>
          </button>
        </div>
        <p className="sidebar__ver">Nexora Vision Play Admin</p>
      </div>
    </aside>
  );
}
