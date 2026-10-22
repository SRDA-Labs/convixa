# Personal Signer Dashboard

## What It Is

The Personal Signer Dashboard is a unified view of every pending transaction that needs your signature — across every organization, every Safe, every chain. Instead of switching between orgs in Safe UI or Convixa, you see everything in one queue.

## The Problem It Solves

If you're a signer for multiple organizations, your signing workflow is fragmented:

- **Org switching:** You have to switch between organizations in Convixa or Safe UI to see pending transactions for each one
- **Chain hopping:** Different Safes are on different chains — you need to check each one separately
- **No priority view:** You can't see which transactions are most urgent across orgs
- **Manual tracking:** You track what needs your signature in your head, a spreadsheet, or Discord DMs
- **Missed deadlines:** Transactions sit unactioned because you didn't know they were waiting

This isn't just inconvenient — it creates operational risk. Urgent transactions get delayed. Signers burn out from context-switching. Organizations lose trust in their signers' reliability.

## How It Works

### Wallet Linking

First, link your signing wallets to your Convixa profile:

1. Go to **Settings → General** and scroll to **Linked Wallet**
2. Connect your wallet and sign the SIWE message to verify ownership
3. You can link **multiple wallets** — for example, your Ledger, your MetaMask hot wallet, and a work-specific key
4. Give each wallet a label (e.g., "Ledger", "Work key") for easy identification
5. Set one as your primary wallet

Each linked wallet is cryptographically verified via SIWE — Convixa knows you control these addresses.

### The Queue

Once your wallets are linked, Convixa automatically discovers every Safe where you're a signer and builds your personal queue:

- **Pending transactions waiting for you:** Every transaction where you're listed as a signer but haven't confirmed yet
- **Grouped by wallet → organization → Safe:** See which org and Safe each transaction belongs to
- **Context at a glance:** Transaction type, recipient, value, confirmation progress (e.g., "2/5 confirmed"), submission date
- **Direct action:** Each transaction has a "Sign in Safe" link that opens Safe{Wallet} directly to that Safe

### The Dashboard Widget

Your personal queue also appears as a widget on the main Dashboard overview:

- **Pending count:** "7 transactions waiting across 3 orgs, 5 Safes"
- **Top items:** The 3 most recent transactions requiring your signature
- **Quick access:** Click through to the full Signer Identity page for the complete queue

### Signer Identity Page

The full Signer Identity page (`/dashboard/signer-identity`) has four tabs:

| Tab | What You See |
|-----|-------------|
| **Overview** | Your reputation score, registry status, quick stats |
| **My Queue** | Every pending transaction waiting for you, grouped and filterable |
| **My Safes** | All Safes where you're a signer, plus any Safes you're watching |
| **Registry** | Your registered addresses — manage visibility, display name, and settings |

### My Safes

The "My Safes" tab shows every Safe where you're a signer — including Safes that aren't in your Convixa organization. This is powerful for signers who work across multiple orgs:

- Safes are grouped by network and show threshold, signer count, and your role
- Click any Safe to see its details, transaction history, and pending queue
- Add Safes you're watching (not a signer on) for monitoring

### Auto-Refresh

Your queue refreshes automatically via Convixa's alerting poller. You don't need to manually refresh — new transactions appear within ~15 seconds of being proposed.

## Privacy

Your personal queue is private to you. Other members of your organizations cannot see your queue. Convixa only shows you Safes where your verified wallet addresses are signers.

## Key Capabilities

- **Multi-wallet support:** Link multiple signing wallets (Ledger, MetaMask, work keys)
- **Cross-org aggregation:** See pending transactions across all organizations in one view
- **Auto-discovery:** Convixa automatically finds all Safes where you're a signer
- **Direct action links:** One click to open Safe{Wallet} for any pending transaction
- **Safe watching:** Monitor Safes you're not a signer on
- **Label management:** Name your wallets for easy identification
- **Auto-refresh:** Queue updates within ~15 seconds via the alerting poller

## Expected Outcomes

After setting up your personal dashboard:
1. You see every transaction needing your signature in one view — zero org switching
2. Urgent transactions don't get buried across multiple org contexts
3. Your response time improves because you have a single prioritized queue
4. You build a verifiable reputation through your signing activity
5. Organizations you sign for see improved signer reliability
