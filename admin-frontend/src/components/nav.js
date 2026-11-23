import {
  DashboardIcon, NetworkIcon, ListIcon, UsersIcon, UserClockIcon, HistoryIcon,
  DepositIcon, WithdrawIcon, ReceiptIcon, CoinsIcon, ProvidersIcon, GamepadIcon, SettingsIcon, WalletIcon,
} from './Icons.jsx';

// Sidebar structure. `count` names a header-stats field shown as a badge;
// `adminOnly` items are shown to the top admin (role 1) only.
export const NAV = [
  {
    section: 'Overview',
    items: [{ to: '/', label: 'Dashboard', Icon: DashboardIcon, end: true }],
  },
  {
    section: 'Agents',
    items: [
      { to: '/agents/treeview', label: 'Agent Tree', Icon: NetworkIcon },
      { to: '/agents/list', label: 'Agent List', Icon: ListIcon },
    ],
  },
  {
    section: 'Members',
    items: [
      { to: '/members/list', label: 'Members', Icon: UsersIcon },
      { to: '/members/waited', label: 'Waiting Approval', Icon: UserClockIcon, count: 'waitedUsers', tone: 'danger' },
      { to: '/members/gamehistory', label: 'Game History', Icon: HistoryIcon },
    ],
  },
  {
    section: 'Money',
    items: [
      { to: '/money/deposit', label: 'Deposits', Icon: DepositIcon, count: 'deposit', tone: 'warn' },
      { to: '/money/withdraw', label: 'Withdrawals', Icon: WithdrawIcon, count: 'withdraw', tone: 'warn' },
      { to: '/money/transaction', label: 'Transactions', Icon: ReceiptIcon },
      { to: '/money/point-log', label: 'Point Log', Icon: CoinsIcon },
      { to: '/money/wallet', label: 'Crypto Wallet', Icon: WalletIcon, adminOnly: true },
    ],
  },
  {
    section: 'Games',
    items: [
      { to: '/games/providers', label: 'Providers', Icon: ProvidersIcon },
      { to: '/games/list', label: 'Games', Icon: GamepadIcon },
    ],
  },
  {
    section: 'System',
    items: [{ to: '/system/setting', label: 'Settings', Icon: SettingsIcon }],
  },
];
