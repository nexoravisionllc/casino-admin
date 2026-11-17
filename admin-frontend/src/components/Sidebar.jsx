import {
  DashboardIcon, MonitorIcon, NetworkIcon, PersonIcon, GamepadIcon,
  TransferIcon, BarChartIcon, ClipboardIcon, BroadcastIcon,
} from './Icons.jsx';

// Dark icon rail. Dashboard, System, Agents and Games are wired; rest placeholders.
const items = [
  { key: 'dashboard', Icon: DashboardIcon, label: 'Dashboard' },
  { key: 'system', Icon: MonitorIcon, label: 'System' },
  { key: 'agents', Icon: NetworkIcon, label: 'Agents' },
  { key: 'members', Icon: PersonIcon, label: 'Members' },
  { key: 'games', Icon: GamepadIcon, label: 'Games' },
  { key: 'money', Icon: TransferIcon, label: 'Money' },
  { key: 'reports', Icon: BarChartIcon, label: 'Reports' },
  { key: 'settlement', Icon: ClipboardIcon, label: 'Settlement' },
  { key: 'live', Icon: BroadcastIcon, label: 'Live' },
];

export default function Sidebar({ active, onSelect }) {
  return (
    <aside className="rail">
      <nav className="rail__nav">
        {items.map(({ key, Icon, label }) => (
          <button
            key={key}
            className={`rail__item ${active === key ? 'is-active' : ''}`}
            title={label}
            onClick={() => onSelect(key)}
          >
            <Icon width={22} height={22} />
          </button>
        ))}
      </nav>
    </aside>
  );
}
