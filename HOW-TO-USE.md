# How to use the Nexora Vision Play admin panel

This guide is for **operators and agents** who run the casino from the admin panel: approving players, handling deposits and withdrawals, managing the agent network, and controlling games.

For installation, see `Setup.md` in the `casino-user` repo. For what players see, see `HOW-TO-USE.md` in the same repo.

## Contents

1. [Accounts, roles and the network](#1-accounts-roles-and-the-network)
2. [Signing in](#2-signing-in)
3. [Layout and the header](#3-layout-and-the-header)
4. [Daily checklist](#4-daily-checklist)
5. [Dashboard](#5-dashboard)
6. [Agents: Agent Tree](#6-agents-agent-tree)
7. [Agents: Agent List](#7-agents-agent-list)
8. [Members](#8-members)
9. [Waiting Approval](#9-waiting-approval)
10. [Game History](#10-game-history)
11. [Deposits and Withdrawals](#11-deposits-and-withdrawals)
12. [Transactions](#12-transactions)
13. [Point Log](#13-point-log)
14. [Providers and Games](#14-providers-and-games)
15. [Settings: game visibility](#15-settings-game-visibility)
16. [Fortune Gate balance and RTP](#16-fortune-gate-balance-and-rtp)
17. [Common tasks, step by step](#17-common-tasks-step-by-step)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. Accounts, roles and the network

There are two kinds of accounts:

| Kind | Signs in at | Stored in | Created by |
|---|---|---|---|
| **Partners**: Super Admin and agents | the admin panel | `Partners` table | the server command `create-admin` (Super Admin), or **Create sub** in the panel |
| **Members**: players | the player site | `Users` table | the player's own **Sign Up** (needs approval), or **Create sub** in the panel (active immediately) |

Everyone sits in one **tree**. The Super Admin is at the top. Agents sit under the Super Admin or under other agents, and members sit under an agent.

```text
Super Admin (Level A)
├── Agent (Level B)
│   ├── Sub-agent (Level C)
│   │   └── member
│   └── member
└── member            ← players who signed up without a referral ID land here
```

- Each agent shows a **level badge** (A, B, C, …) for its depth in the tree. The Super Admin is level A.
- A player who signs up with an agent's **Referral ID** is placed under that agent. Without one, the player goes under the Super Admin.
- Every agent has three **commission rates** (Casino, Slot, Sports). Section 6 covers how they work.

> **Important: permissions.** In the current version, **every panel account can see the whole network and use every function**: approving players, accepting money requests, paying members, changing RTP, and so on. The tree and the scope filters are for navigation only; they don't restrict access. Give admin-panel logins only to people you trust with full control.

## 2. Signing in

1. Open the admin site (e.g. `https://admin.example.com`).
2. Enter your **Login ID** and **Password**, then click **Sign in**.
3. A session lasts up to **12 hours**. After that you're asked to sign in again.

The panel has no public sign-up. New agents are created by an existing account through **Create sub**. To create another Super Admin, run this on the server:

```bash
sudo -iu casino
cd /opt/casino/casino-admin/admin-backend
npm run create-admin -- newlogin 'strong-password' 'Display Name'
```

**Forgotten password:** another panel account can set a new one in **Agent Tree → Change password**. If the only Super Admin is locked out, create a new one with the command above.

## 3. Layout and the header

- **Sidebar (left):** the sections described below. Red and yellow badges show how many items are waiting (players to approve, pending deposits and withdrawals). Use ☰ to collapse the sidebar to icons. On a phone it opens as a drawer.
- **Header (top):**
  - **Fortune Gate balance** and **RTP**: the casino's agent account at the game supplier (section 16).
  - **Counters**: members waiting approval, pending deposits, pending withdrawals. Click one to jump to its page. They refresh every few seconds.
  - Your **account menu**: name, level, the **Dark / Light** theme switch, and **Logout**.
- **Live updates:** lists and numbers update by themselves when something changes, for example a new deposit request or a player's balance changing after a game. You rarely need to refresh.
- **Time zone:** all times are shown in **your computer's local time**.
- **Currency:** all amounts are **USD**. Points are shown with a **P**.

## 4. Daily checklist

1. Check the header counters.
2. **Waiting Approval:** approve legitimate sign-ups.
3. **Deposits:** match each request to a received payment, then **Accept**. **Reject** requests you can't match.
4. **Withdrawals:** pay out to the member's bank, then **Accept**. **Reject** requests you won't pay.
5. Check the **Dashboard** for unusual bet and win activity, and check that the **Fortune Gate balance** is healthy.

## 5. Dashboard

An overview of the whole casino:

- **Tiles:** **Fortune Gate balance**, **Member balance** (all players combined), **Agent balance**, and **Members** (player count).
- **Last 7 days** and **Monthly game report** (12 months): bets and wins per day or month.
- **Pending requests:** members waiting for approval and the latest deposits and withdrawals waiting for you. Each has a **Review** link.

## 6. Agents: Agent Tree

The main page for managing the network.

- **Left:** the tree. Type in **Search** to find an agent or member by name or login ID. Use expand and collapse all, and arrow keys to move around. The numbers next to each branch count everything under it.
- **Right:** the **agent profile** for the selected agent. It opens on your own account.

The profile shows the agent's wallet, downline counts (sub-agents and members), **Commission rates**, **Referral ID**, and its **Direct downline**. It also has these actions:

### Create sub (new agent or member)

1. Select the parent agent in the tree and click **Create sub**.
2. Choose **Agent** or **Member** at the top of the form.
3. Fill in **Name**, **Login ID** and **Password** (required), plus optional email and bank details (**Bank name**, **Account number**, **Depositor name**).
   - For an **Agent**, also set the **Referral ID** and the three **rates**. The login ID is checked for availability as you type.
4. Click **Create agent** or **Create member**. Members created here are **active immediately**; they don't need approval.

### Commission rates

Each agent has a **Casino**, **Slot** and **Sports** rate, in percent. The rules:

- An agent's rate **can't be higher than its parent's** rate. Children of the Super Admin can go up to 100%.
- An agent's rate **can't be lower than the highest rate among its own sub-agents**.

When you save a value that breaks a rule, you'll see a message such as *Slot rate cannot be higher than the master's rate (4%).* Raise the parent first, or lower the children first.

> An agent's share is the difference between its own rate and its direct sub-agent's rate, applied to the bets made under it. The panel stores and validates the rates; settlement happens outside this panel.

### Referral ID

Click the edit icon next to **Referral ID** to set or change the agent's code. Players who enter this code at sign-up are placed under this agent. Clearing it means nobody new can join through this agent.

### Change password

Sets a new password for the selected **agent** (or for yourself). There's currently no panel function to change a member's password.

### Delete agent

Removes the agent. It isn't allowed if:

- the agent still has **sub-agents** (*Remove the sub agents first.*), or
- it's your own account.

## 7. Agents: Agent List

The same agents as a searchable table: **Agent**, **Hierarchy** (its chain of parents), **Parent**, **Wallet**, **Rates**, **Status** and **Created**. It's useful for finding an agent quickly.

- Click the edit icon next to a rate to change that rate (the rules in section 6 apply).
- The row buttons are **Create sub**, **Change password** and **Delete**. Your own row has no Delete.
- **Tree view** switches to the Agent Tree.

## 8. Members

All players, scoped by the tree on the left.

- Click an agent in the tree to see only the members in its branch. Click **All members** to see everyone.
- **Search** by name, login ID or email.
- Columns: **Member**, **Agent** (direct parent), **Hierarchy**, **Wallet** (balance and points), **Deposits / Withdrawals** (totals), **Status**, **Joined**, and **Adjust**.
- **Create sub** adds a member under the selected agent (section 6).

### Pay and Collect (manual balance or points change)

The **Adjust** column of each member row has four buttons:

| Button | Effect |
|---|---|
| **+$** | Pay: add to balance |
| **−$** | Collect: subtract from balance |
| **+P** | Pay: add points |
| **−P** | Collect: subtract points |

1. Click a button, check the member, and choose **Pay** or **Collect**.
2. Enter an amount greater than zero.
3. Confirm. The change is **immediate**, and the player's screen updates within a second.

You can't collect more than the member has. Every change is recorded: balance changes in **Transactions** (type *payment* or *collect*), and point changes in the **Point Log**.

Use **+P** to give bonuses. Players can convert points to balance themselves at 1P = $1.

## 9. Waiting Approval

Players who signed up on the player site appear here with status **Pending**. They can't sign in until approved.

1. Review the name, login ID, referral (parent agent) and bank details.
2. Click **Approve**. The account becomes **Active** immediately and disappears from this list.

The panel can't reject a sign-up. An unapproved account stays pending and can never sign in. To remove one, ask your server administrator to delete it from the database.

## 10. Game History

Every game round reported by the game supplier.

- Filter by the tree (with **Include sub-agents**), by date range, and by **Search** (user, game, provider or round ID).
- Columns: time, member, game and provider, **Bet**, **Win**, **Rolling**, round ID.
- The summary at the top totals **Bet / Win / Rolling / Profit / Cancel** for the current filter. Profit is from the casino's side (bets minus wins).

## 11. Deposits and Withdrawals

Players submit requests from the player site. Each one waits here as **pending** until you act on it. A member can have at most one pending deposit and one pending withdrawal at a time.

### Deposits

Each request shows the member, amount, balance at the time of the request, depositor and bank details, and the request time.

| Action | When to use | Effect |
|---|---|---|
| **Accept** | You've **received** the money | Adds the amount to the member's balance, status **finished** |
| **Reject** | No matching payment | No balance change, status **rejected** |
| **Restore** | Undo an **accepted** deposit (for example, a payment bounced) | Subtracts the amount again and reverses the deposit totals |

### Withdrawals

| Action | When to use | Effect |
|---|---|---|
| **Details** | Before paying | Shows the member, email, balance, history, and where to pay (wallet address and network with a Copy button, or bank details) |
| **Accept** | You've **sent** the money yourself (crypto from your wallet, or bank transfer) | Subtracts the amount from the balance, status **finished**. Optionally enter the payment reference (tx hash / transfer ID). The member is emailed. |
| **Reject** | You won't pay it | Requires a reason. No balance change, status **rejected**. The member sees the reason and is emailed. |

Nothing is sent automatically: crypto withdrawals are paid by hand to the address shown in **Details**. Check the network before sending.

The balance is **not** reserved when the player requests a withdrawal. If the player has since lost the money in games, **Accept** fails with *User has insufficient balance for this withdrawal.* In that case, **Reject** the request.

Every action asks for confirmation. Accepted requests appear in the member's history and update their balance on screen immediately.

## 12. Transactions

Every balance movement for members and agents:

- deposit
- withdraw
- payment / collect (manual, from Members)
- point-convert (player turned points into balance)

Filter by tree scope (**Everyone** or one agent's branch), **All types** / **All statuses** selectors, date range, and search. **Before / After** show the balance around each movement, **Processed by** shows which panel account acted, and **Memo** describes it (for example *Admin pays 50$ to player1*).

## 13. Point Log

The same idea for **points**: manual point pay and collect, and players' point conversions. Filter by tree scope (with **Include sub-agents**), type and date.

## 14. Providers and Games

### Providers

The grid of game studios (providers) available from the game supplier.

To change a provider's logo, click the provider and either:

- **Image file:** upload PNG, JPG, GIF, WEBP or SVG, up to **5 MB**; or
- **Image URL:** paste a link to an image, then click **Save URL**.

The new image appears on the player site's **All Providers** page.

### Games

The list of games stored for the player site: **Game**, **Provider**, **Company**, **Symbol**, **Category**, and **Launch**. **Launch** is **On** when players can start the game and **Off** when they can't. The page title shows how many games are launchable. Use **Search** (game name or symbol) to find a game.

This page is read-only.

## 15. Settings: game visibility

Turn whole game categories **on or off for players**. Changes apply immediately.

| Switch | When off |
|---|---|
| **Slots** | The Slots menu, home page row and slot games are hidden on the player site. |
| **Live Casino** | Live-casino providers are hidden on the player site. |
| **Sports** | Reserved for the sports section. |

Players who already have the site open see the change the next time they load the page.

## 16. Fortune Gate balance and RTP

The casino plays games through a **Fortune Gate agent account**.

- **Fortune Gate balance** (header and dashboard) is that account's balance at the supplier. If it runs low, games may stop launching or paying, so top it up with the supplier in time.
- **RTP** (return to player) is the win ratio the supplier applies to the casino's games. To change it, click the edit button next to the RTP value in the header (**Change RTP**), enter a **Win ratio (RTP %)** between **0 and 100**, and save. The supplier applies it straight away.

Only change the RTP if you understand the effect on payouts.

## 17. Common tasks, step by step

**Add a new agent with their own referral code**
Agent Tree → select the parent → **Create sub** → **Agent** → fill in name, login ID, password, referral ID and rates → **Create agent**. Give the agent their admin-panel login and their referral ID to share with players.

**A player says their deposit hasn't arrived**
Deposits → find the request → confirm the payment in your bank → **Accept**. If there's no request, the player hasn't submitted one; ask them to use **Deposit** on the player site.

**Give a player a $50 bonus as points**
Members → find the player → **+P** → **Pay** 50 → confirm. The player can convert it under **Point Convert**.

**Correct a wrong balance**
Members → find the player → **+$** or **−$** → enter the difference → confirm. The correction appears in Transactions as *payment* or *collect*.

**Undo a deposit you accepted by mistake**
Deposits → find the finished request → **Restore**.

**Temporarily hide slots**
Settings → turn **Slots** off.

## 18. Troubleshooting

| Problem | What to do |
|---|---|
| *Invalid ID or password.* | Check the login ID (case matters) and password. Another account can reset an agent's password in Agent Tree. |
| *This account is not active.* | The account is disabled in the database. Ask the server administrator. |
| Counters and lists stop updating live | Refresh the page. If it keeps happening, the server's live-update connection (`/hubs/wallet`) isn't reaching the browser. See *Troubleshooting* in `Setup.md`. |
| A player's balance doesn't update live on the player site | Usually `NOTIFY_SECRET` differs between the two backends. See *The player's balance doesn't update live* in `Setup.md`. |
| *Pending request exists.* (reported by a player) | The player already has a pending request of that type. Accept or reject it first. |
| Accepting a withdrawal fails with *insufficient balance* | The player spent the balance after requesting. **Reject** the request. |
| Rate change refused | Check the parent's rate (maximum) and the sub-agents' highest rate (minimum). See section 6. |
| *Remove the sub agents first.* | Delete or move the agent's sub-agents before deleting it. |
| Provider image upload fails | The file is over 5 MB or not an image type. Try a smaller PNG, JPG or WEBP. |
| Fortune Gate balance shows 0 or doesn't load | The server can't reach Fortune Gate, or the agent token is wrong. Ask the server administrator to check `FORTUNEGATE_TOKEN`. |
