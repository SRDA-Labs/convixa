# Safe Inventory & Observability

## What It Is

The Safe Inventory is your single source of truth for every multisig wallet your organization controls. Add your Safes once, and Convixa tracks their balances, signer configurations, pending transactions, and history — across 9 supported chains.

## The Problem It Solves

Organizations using Safe typically have wallets spread across multiple chains and teams. To check what's happening, you need to:
- Open Safe{Wallet} separately for each Safe on each chain
- Manually compile balances across wallets
- Track signer changes by comparing snapshots
- Remember which team manages which Safe

When you have 20+ Safes across 5 chains and 3 teams, this becomes a full-time coordination effort — or things get missed.

## How It Works

### Adding a Safe

1. Click **Add Safe** from the dashboard or inventory page
2. Enter your Safe's address and select its network
3. Optionally give it a name (e.g., "Treasury Main") and assign it to a team
4. Convixa fetches everything from the Safe Transaction Service API:
   - Current signer list and threshold
   - All token balances (native + ERC20)
   - Pending transaction queue
   - Recent transaction history

No contract changes. No on-chain transactions. Your Safe stays exactly as it is.

### The Dashboard Overview

The dashboard gives you instant answers to the questions treasury managers ask every day:

| Question | Where to find it |
|----------|-----------------|
| How many Safes do we have? | Overview KPI card |
| What's our total balance across all Safes? | Aggregate Balance card (with per-token breakdown) |
| How many transactions are waiting for signatures? | Pending Approvals counter |
| How many unique signers do we have? | Total Signers counter |
| Which Safes have the most pending transactions? | Managed Safes table, sorted by pending count |
| What changed recently? | Activity sidebar — every Safe addition, snapshot refresh, and admin action |

### Safe Detail View

Click any Safe to see everything about it on one page:

- **Balance** — Live token balances with USD values
- **Signers** — Full owner list with threshold (e.g., "3 of 5"). Registered signers show reputation badges with their cross-org score.
- **Pending Queue** — Every unexecuted transaction with type, recipient, value, and confirmation progress
- **Transaction History** — Executed transactions with dates, values, and types
- **Quick Actions** — Open in Safe{Wallet}, refresh snapshot

### Inventory Management

The Inventory page is a searchable, sortable table of every Safe:
- Filter by team
- Sort by network, pending count, last refreshed
- See threshold, signer count, and pending transactions at a glance
- Click through to any Safe's detail page

## Key Capabilities

- **9 supported chains:** Ethereum, Base, Arbitrum, Polygon, Optimism, Gnosis Chain, Avalanche, BSC, Sepolia
- **Auto-refresh:** Safe snapshots update every ~15 seconds via the alerting poller
- **Manual refresh:** Click "Refresh" on any Safe to fetch the latest data immediately
- **Team scoping:** Each Safe belongs to a team — members only see Safes in their teams
- **Export:** Export your full inventory to CSV for reporting
- **Activity feed:** Every action is logged — know who added which Safe, when snapshots were refreshed, and what changed

## Expected Outcomes

After setting up your Safe inventory, you should be able to:
1. Answer "what's our total treasury?" in 5 seconds — without opening Safe UI
2. See every pending transaction across all Safes in one view
3. Know who the signers are on every Safe, with verified identities
4. Track changes over time through the activity feed
5. Export data for reporting, compliance, and board presentations
