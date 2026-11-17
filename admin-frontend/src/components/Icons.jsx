// Inline SVG icons (24px grid, 2px stroke). Color comes from currentColor.
const b = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', width: 20, height: 20 };
const I = (paths) => (p) => <svg {...b} {...p}>{paths}</svg>;

// --- Navigation ---
export const DashboardIcon = I(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>);
export const NetworkIcon = I(<><rect x="9" y="2.5" width="6" height="5" rx="1.2" /><rect x="2.5" y="16.5" width="6" height="5" rx="1.2" /><rect x="15.5" y="16.5" width="6" height="5" rx="1.2" /><path d="M12 7.5v4.5M5.5 16.5V12h13v4.5" /></>);
export const ListIcon = I(<><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></>);
export const UsersIcon = I(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5 6.5-5s6.5 1.5 6.5 5" /><path d="M16 5.5a3.2 3.2 0 010 5.6M18 20c0-2.6-1-4.2-3-5" /></>);
export const UserClockIcon = I(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5 6.5-5 1 0 2 .1 2.9.4" /><circle cx="17.5" cy="17" r="4" /><path d="M17.5 15.2V17l1.2.8" /></>);
export const HistoryIcon = I(<><path d="M3 12a9 9 0 103-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>);
export const DepositIcon = I(<><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 20h16" /></>);
export const WithdrawIcon = I(<><path d="M12 21V9M7 14l5-5 5 5" /><path d="M4 4h16" /></>);
export const ReceiptIcon = I(<><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><path d="M9 7h6M9 11h6M9 15h4" /></>);
export const CoinsIcon = I(<><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.6-2.4-2.9-5.5-3" /></>);
export const ProvidersIcon = I(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>);
export const GamepadIcon = I(<><rect x="2" y="7" width="20" height="10" rx="5" /><path d="M7 12h3M8.5 10.5v3" /><circle cx="16" cy="11" r="1" fill="currentColor" /><circle cx="18" cy="13" r="1" fill="currentColor" /></>);
export const SettingsIcon = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></>);

// --- Values / stats ---
export const DollarIcon = I(<path d="M12 2v20M17 6c-1-1.5-3-2-5-2-3 0-5 1.5-5 4s2 3 5 3 5 1 5 3.5-2 4-5 4c-2 0-4-.5-5-2" />);
export const PointIcon = (p) => (
  <svg viewBox="0 0 24 24" width={20} height={20} {...p}><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M10 16.5v-9h3a2.5 2.5 0 010 5h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const WalletIcon = I(<><path d="M20 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h13a2 2 0 002-2v-2" /><path d="M21 8h-6a4 4 0 000 8h6z" /><circle cx="15.5" cy="12" r=".8" fill="currentColor" /></>);
export const GateIcon = I(<><path d="M4 21V6l8-3 8 3v15" /><path d="M4 21h16M9 21v-6a3 3 0 016 0v6" /></>);
export const BarChartIcon = I(<path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />);
export const ClockIcon = I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const TrendIcon = I(<><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>);
export const ArrowRightIcon = I(<path d="M5 12h14M13 6l6 6-6 6" />);
export const ArrowUpIcon = I(<path d="M12 19V5M6 11l6-6 6 6" />);
export const ArrowDownIcon = I(<path d="M12 5v14M6 13l6 6 6-6" />);
export const PercentIcon = I(<><path d="M19 5L5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>);
export const LinkIcon = I(<><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" /></>);
export const CalendarIcon = I(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>);
export const ShieldIcon = I(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />);
export const BoltIcon = I(<path d="M13 2L3 14h9l-1 8 10-12h-9z" />);

// --- UI ---
export const MenuIcon = I(<path d="M3 6h18M3 12h18M3 18h18" />);
export const SearchIcon = I(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></>);
export const CloseIcon = I(<path d="M18 6L6 18M6 6l12 12" />);
export const ChevronDownIcon = I(<path d="M6 9l6 6 6-6" />);
export const ChevronRightIcon = I(<path d="M9 6l6 6-6 6" />);
export const ChevronLeftIcon = I(<path d="M15 6l-6 6 6 6" />);
export const CheckIcon = I(<path d="M20 6L9 17l-5-5" />);
export const PlusIcon = I(<path d="M12 5v14M5 12h14" />);
export const EditIcon = I(<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" /></>);
export const TrashIcon = I(<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></>);
export const KeyIcon = I(<><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3L21 2M16 7l3 3M18 5l2 2" /></>);
export const UserPlusIcon = I(<><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6" /><path d="M19 8v6M22 11h-6" /></>);
export const RefreshIcon = I(<><path d="M21 12a9 9 0 01-15.5 6.2L3 16" /><path d="M3 12a9 9 0 0115.5-6.2L21 8" /><path d="M21 3v5h-5M3 21v-5h5" /></>);
export const ExpandIcon = I(<><path d="M7 15l5 5 5-5" /><path d="M7 9l5-5 5 5" /></>);
export const CollapseIcon = I(<><path d="M7 20l5-5 5 5" /><path d="M7 4l5 5 5-5" /></>);
export const SunIcon = I(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const MoonIcon = I(<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />);
export const LogoutIcon = I(<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>);
export const EyeIcon = I(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>);
export const EyeOffIcon = I(<><path d="M17.9 17.9A10.4 10.4 0 0112 19c-6.5 0-10-7-10-7a18.4 18.4 0 015.1-5.9M9.9 5.2A9.1 9.1 0 0112 5c6.5 0 10 7 10 7a18.5 18.5 0 01-2.2 3.2" /><path d="M14.1 14.1a3 3 0 01-4.2-4.2M2 2l20 20" /></>);
export const AlertIcon = I(<><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" /></>);
export const InboxIcon = I(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.7 4H7.3a2 2 0 00-1.8 1.1z" /></>);
export const ImageIcon = I(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>);
export const LayersIcon = I(<><path d="M12 2l10 5-10 5L2 7z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></>);
export const BroadcastIcon = I(<><circle cx="12" cy="12" r="2" /><path d="M7 7a7 7 0 000 10M17 7a7 7 0 010 10M4 4a11 11 0 000 16M20 4a11 11 0 010 16" /></>);
