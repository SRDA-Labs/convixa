# Product Overview

## What is Convixa?

Convixa is a **multisig observability and security platform** built on top of the Safe ecosystem. It connects to your existing Safe wallets — no migration, no new contracts — and gives you a unified command center across every chain, every team, and every organization.

If your organization uses Safe multisig wallets, Convixa is the missing layer that tells you **what's happening, who's involved, and whether it's safe** — before transactions are executed.

## Who is Convixa for?

| Persona | What Convixa gives them |
|---------|------------------------|
| **Treasury Managers** | Visibility into every Safe across every chain. Know balances, pending transactions, and signer activity in one place. |
| **Security Leads** | Real-time alerts the moment a transaction is proposed. Policy rules that flag suspicious activity. On-chain guard contracts for enforcement. |
| **Multisig Signers** | A personal queue of every transaction waiting for their signature — across all orgs, all chains. No more switching orgs or logging into Safe UI per chain. |
| **Org Admins** | Team-based access control. Custom roles. Invite links. Full audit trail of every action. |
| **Compliance Teams** | Cross-org signer identity. Know when a signer leaves one org but still has access at another. Reputation tracking across the industry. |

## Core Capabilities

### 1. Safe Inventory & Observability
Add your Safes once. Convixa tracks balances, signer lists, thresholds, pending transactions, and transaction history — across Ethereum, Base, Arbitrum, Polygon, Optimism, Gnosis Chain, Avalanche, BSC, and Sepolia.

### 2. Real-Time Proposal Alerting
Get notified via email or Slack the instant a transaction is proposed on any Safe. Alerts classify transactions by type — governance changes (add/remove signer, change threshold), token transfers, approvals, and contract calls — so you know exactly what needs attention.

### 3. Policy Engine
Define rules that evaluate every pending transaction before execution. Flag transactions that exceed thresholds, interact with unapproved addresses, or match suspicious patterns. Policies can alert your team or block execution entirely via on-chain guards.

### 4. Verified Signer Registry
An opt-in identity layer that maps wallet addresses to verified humans across organizations. Prove you control an address via cryptographic signature (SIWE). Build cross-org reputation. Get alerted when a signer's employment status changes at another org but they still have signing power on your Safes.

### 5. Personal Signer Dashboard
If you sign for multiple organizations, Convixa shows every pending transaction that needs your signature — in one view. No switching orgs. No logging into Safe UI per chain. Just your queue, your Safes, your activity.

### 6. Organization & Team Management
Structure your organization with teams, each scoped to specific Safes. Assign team leads. Create custom roles with granular permissions. Invite members via secure links. Every action is audit-logged.

## How Convixa Works (30-Second Summary)

1. **Connect your Safe.** Add your Safe address to Convixa — it reads data from the Safe Transaction Service API. No on-chain changes needed.

2. **Get visibility.** Convixa shows balances, signers, pending transactions, and history across all your Safes in one dashboard.

3. **Get alerted.** The alerting engine polls your Safes every ~15 seconds. When a new transaction is proposed, you get an email or Slack notification.

4. **Set policies (optional).** Define rules that evaluate transactions. Want to be alerted when any transfer exceeds 50 ETH? When a signer is being added or removed? When a transaction interacts with an address on your blocklist? Done.

5. **Register as a signer (optional).** Prove you control your signing address. Your reputation builds as you sign across organizations. When you leave one org, the system alerts every other org where you're still a signer — helping them rotate keys before it becomes a security incident.

6. **Enforce on-chain (optional).** Deploy a Safe guard contract that enforces your policies directly on the Safe. Transactions that violate your rules cannot be executed.

## What Convixa Doesn't Do

- **Doesn't require contract changes.** Convixa reads from Safe's existing APIs. Your Safes stay exactly as they are.
- **Doesn't custody funds.** Convixa never holds your assets or private keys.
- **Doesn't replace Safe.** You still use Safe{Wallet} to propose and sign transactions. Convixa is the observability and security layer on top.
- **Doesn't require KYC.** The Signer Registry verifies key control (via SIWE), not legal identity. Identity linking is optional.
