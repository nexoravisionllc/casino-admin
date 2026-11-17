# BC-Solution Admin

Admin & agent panel for the casino platform. Login and dashboard are implemented.

## Stack

| Part     | Technology                                             |
|----------|--------------------------------------------------------|
| Frontend | React 19 + Vite 6 (Node.js v26.5.0, not on PATH)       |
| Backend  | Node.js (>= 20.12) + Express 5, in `admin-backend/`    |
| Realtime | SignalR-compatible hub at `/hubs/wallet` (WebSockets, SSE, long polling) |
| Database | **Solution** MySQL 8+ database (formerly SQL Server)   |
| Auth     | JWT; login authenticates against the `Partners` table  |

The backend was ported from the ASP.NET Core 8 `AdminBackend/` project. The HTTP
API, JSON shapes, JWTs (same key/issuer/audience), password hashes and the
SignalR hub protocol are unchanged, so the admin frontend, the user front page
and the user backend's `/api/wallet/notify` calls work as before.

## Accounts (in the shared Partners table)

Both use password `@12345#$%`.

| LoginId | Role | Casino/Slot/Sports rate |
|---------|------|-------------------------|
| `Admin` | 1 (super admin) | 0 / 0 / 0 |
| `agent` | 2 (top agent)   | 5.0 / 4.0 / 3.0 |

## Run

Requires a MySQL 8+ server. Accounts come from the migrated `Partners` table.

**Backend** (http://localhost:5100):
```powershell
./start-backend.ps1
```

Configuration lives in `admin-backend/.env` (see `.env.example`; real
environment variables override it). Set `DB_HOST`, `DB_USER`, `DB_PASSWORD`
and `DB_NAME` (or `DATABASE_URL`). On startup the backend creates the database
and all tables if they are missing (`admin-backend/src/schema.js`).

### Moving the data from SQL Server

Run once, with `MSSQL_CONNECTION_STRING` in `.env` pointing at the old database:

```powershell
cd admin-backend
npm run migrate:mssql            # copies every table that is empty in MySQL
npm run migrate:mssql -- --force # replaces existing MySQL rows
```

Ids are preserved, and source columns that don't exist in MySQL are reported
instead of copied. Windows authentication to SQL Server needs a SQL Server ODBC
driver (preferably *ODBC Driver 18 for SQL Server*).

> The user portal (and the user backend) also used this database. They must be
> pointed at MySQL too; until then they keep writing to SQL Server.

In production, run `npm start` as a service (e.g. NSSM or pm2) and put IIS
(ARR + URL Rewrite, with the **WebSocket Protocol** feature enabled) or nginx in
front of it. Set `TRUST_PROXY=true` there (or `PUBLIC_BASE_URL`) so uploaded image
URLs use the public `https://` host.

**Frontend** (http://localhost:5174):
```powershell
./start-frontend.ps1
```

Open http://localhost:5174 and sign in with `Admin` / `@12345#$%`.

## Pages

The UI shares the user portal's design system (dark / light theme, Inter, green
brand + gold accent). Layout: fixed header (Fortune Gate balance + RTP, pending
counters, account menu), grouped sidebar (collapses to an icon rail; drawer on
mobile).

- **Login** — split card: brand panel + sign-in form. There is no public sign-up;
  agents and members are created by their upline (Create sub).
- **Dashboard** — Fortune Gate / member / agent / member-count tiles, today's money
  flow vs. yesterday, last-7-days and 12-month bet/win charts, pending requests.
- **Agents** — Agent Tree (tree + agent profile: wallet, downline counts, rates,
  referral, actions) and Agent List.
- **Members** — Members (tree-scoped list with balance/point adjust), Waiting
  Approval, Game History.
- **Money** — Deposits, Withdrawals (review queue with confirm dialogs),
  Transactions, Point Log (`PointHistory` table).
- **Games** — Providers (logo grid, change image), Games.
- **System** — Settings (game visibility on the player site).

Every scoped page uses the shared `TreeView` (search, expand/collapse all,
descendant counts, keyboard navigation). Timestamps from the API are UTC and are
shown in the viewer's local time.

## Header

Fortune Gate balance and RTP (editable), plus counters for members waiting
approval and pending deposits / withdrawals (from `GET /api/dashboard/header`,
polled every 5 s). All amounts are USD.

## Commission rates

`CasinoRate`, `SlotRate`, `SportsRate` were added to the shared `Partners`
schema (percentage, e.g. `1.0`). Top admin = 0; a parent's rate is never lower
than its child's. Each partner earns `bet * (own rate - direct child rate) / 100`
on downline bets (that payout logic lives elsewhere; this schema just exposes the
fields).
