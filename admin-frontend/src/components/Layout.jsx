import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { StatsProvider } from '../context/StatsContext.jsx';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';

const RAIL_KEY = 'admin-sidebar-rail';
const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

// App shell: fixed header, sidebar (full / icon rail on desktop, drawer on
// mobile) and the routed page.
export default function Layout() {
  const [rail, setRail] = useState(() => { try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; } });
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { try { localStorage.setItem(RAIL_KEY, rail ? '1' : '0'); } catch { /* ignore */ } }, [rail]);
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [pathname]);

  const toggle = () => (isMobile() ? setDrawer((v) => !v) : setRail((v) => !v));

  return (
    <StatsProvider>
      <div className={`layout ${rail ? 'layout--collapsed' : ''} ${drawer ? 'layout--drawer' : ''}`}>
        <Header onToggleSidebar={toggle} />
        <div className="layout__body">
          <Sidebar rail={rail} onNavigate={() => setDrawer(false)} />
          <div className="layout__backdrop" onClick={() => setDrawer(false)} />
          <main className="content">
            <Outlet />
          </main>
        </div>
      </div>
    </StatsProvider>
  );
}
