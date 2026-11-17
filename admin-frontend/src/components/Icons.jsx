// Inline SVG icons. Color comes from currentColor.
const b = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', width: 20, height: 20 };

export const EyeIcon = (p) => (
  <svg {...b} {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
);

// --- Sidebar ---
export const DashboardIcon = (p) => (
  <svg {...b} {...p}><path d="M3 15l5-5 4 4 7-8" /><path d="M3 20h18" /></svg>
);
export const MonitorIcon = (p) => (
  <svg {...b} {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
);
export const NetworkIcon = (p) => (
  <svg {...b} {...p}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M7.6 7.8L11 15.4M16.4 7.8L13 15.4" /></svg>
);
export const PersonIcon = (p) => (
  <svg {...b} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
);
export const GamepadIcon = (p) => (
  <svg {...b} {...p}><rect x="2" y="7" width="20" height="10" rx="5" /><path d="M7 12h3M8.5 10.5v3" /><circle cx="16" cy="11" r="1" fill="currentColor" /><circle cx="18" cy="13" r="1" fill="currentColor" /></svg>
);
export const TransferIcon = (p) => (
  <svg {...b} {...p}><path d="M4 9h13l-3-3M20 15H7l3 3" /></svg>
);
export const BarChartIcon = (p) => (
  <svg {...b} {...p}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>
);
export const ClipboardIcon = (p) => (
  <svg {...b} {...p}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>
);
export const BroadcastIcon = (p) => (
  <svg {...b} {...p}><circle cx="12" cy="12" r="2" /><path d="M7 7a7 7 0 000 10M17 7a7 7 0 010 10M4 4a11 11 0 000 16M20 4a11 11 0 010 16" /></svg>
);

// --- Header pills ---
export const DollarIcon = (p) => (
  <svg {...b} {...p}><path d="M12 2v20M17 6c-1-1.5-3-2-5-2-3 0-5 1.5-5 4s2 3 5 3 5 1 5 3.5-2 4-5 4c-2 0-4-.5-5-2" /></svg>
);
export const PointIcon = (p) => (
  <svg viewBox="0 0 24 24" width={20} height={20} {...p}><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">P</text></svg>
);
export const UsersIcon = (p) => (
  <svg {...b} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5 6.5-5s6.5 1.5 6.5 5" /><path d="M16 5.5a3.2 3.2 0 010 5.6M18 20c0-2.6-1-4.2-3-5" /></svg>
);
export const ClockIcon = (p) => (
  <svg {...b} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const WifiIcon = (p) => (
  <svg {...b} {...p}><path d="M5 12.5a10 10 0 0114 0M8 15.5a6 6 0 018 0" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>
);
export const DepositIcon = (p) => (
  <svg {...b} {...p}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 20h16" /></svg>
);
export const WithdrawIcon = (p) => (
  <svg {...b} {...p}><path d="M12 21V9M7 14l5-5 5 5" /><path d="M4 4h16" /></svg>
);
export const GateIcon = (p) => (
  <svg {...b} {...p}><path d="M4 21V6l8-3 8 3v15" /><path d="M4 21h16M9 21v-6a3 3 0 016 0v6" /></svg>
);

// --- Misc ---
export const LogoutIcon = (p) => (
  <svg {...b} {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
);
export const AvatarIcon = (p) => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" {...p}><circle cx="12" cy="9" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6z" /></svg>
);
export const SearchIcon = (p) => (
  <svg {...b} {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
export const UserPlusIcon = (p) => (
  <svg {...b} {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6" /><path d="M19 8v6M22 11h-6" /></svg>
);
export const TrashIcon = (p) => (
  <svg {...b} {...p}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></svg>
);
