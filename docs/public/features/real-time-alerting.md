# Real-Time Alerting

## What It Is

Convixa monitors your Safes continuously and notifies you the moment a transaction is proposed — via email or Slack. Alerts are classified by transaction type so you know immediately whether it's a routine transfer, a governance change, or something that needs urgent attention.

## The Problem It Solves

In Safe{Wallet}, transactions sit in a queue until enough signers approve them. The problem: **you don't know a transaction exists unless someone tells you, or you happen to check.**

- A signer proposes adding a new owner — nobody notices for 3 days
- A 500 ETH transfer sits in the queue with 1 of 5 confirmations
- A contract call to an unverified address is proposed — no alert, no review

By the time someone notices, the transaction may already be executed — or it may be sitting unactioned while signers are unaware they're needed.

Convixa eliminates this gap. You know within ~15 seconds of a proposal being submitted.

## How It Works

### The Alerting Engine

Convixa's alerting engine polls the Safe Transaction Service API every ~15 seconds for each Safe in your organization. When a new pending transaction is detected:

1. **Classification** — The engine decodes the transaction's calldata to determine what it does:
   - **Governance changes:** add signer, remove signer, swap signer, change threshold
   - **Token transfers:** ERC20 transfers, ERC20 approvals, native ETH transfers
   - **Contract calls:** Everything else

2. **Matching** — The classified event is checked against your alert subscriptions. A subscription matches if it has the same event type and is scoped to the same Safe (or all Safes).

3. **Delivery** — If a match is found, the alert is delivered via your chosen channel. Each delivery is recorded and idempotent — you won't get duplicate alerts for the same transaction.

### Creating Alert Rules

1. Go to **Alerts** in the sidebar
2. Click **Create Alert Rule**
3. Configure:
   - **Event type:** Which transaction types to monitor (e.g., "All governance changes" or "ETH transfers above 10 ETH")
   - **Scope:** All Safes in the org, or specific Safes
   - **Channel:** Email or Slack
   - **Recipients:** Individual email addresses, or a recipient list (create lists in Alerts → Lists)

### What an Alert Looks Like

**Email alert example:**
```
Subject: ⚠️ ETH_TRANSFER_PROPOSED on Treasury Main (Ethereum)

A new pending transaction has been detected on your Safe:

Safe: Treasury Main (0x1234...abcd)
Network: Ethereum
Event: ETH Transfer Proposed
Proposed by: 0x5678...ef01
Value: 50.0 ETH
To: 0x1f98...abcd

View in Safe: https://app.safe.global/home?safe=eth:0x1234...
```

**Slack alert example:**
```
⚠️ SIGNER_ADD_PROPOSED on Ops Wallet (Base)

A governance change has been proposed on one of your Safes.

Safe: Ops Wallet (0xabcd...)
Network: Base
Event: Add Signer Proposed
Proposed by: 0x7890...
Summary: addOwnerWithThreshold({"owner":"0xNEW...","threshold":3})
```

### Recipient Lists

For teams where multiple people need to be notified, create recipient lists instead of adding individual emails to each rule:

1. Go to **Alerts → Lists**
2. Create a list (e.g., "Security Team" or "Treasury Signers")
3. Add members by email
4. Use the list in any alert rule

When team members change, update the list once — all alert rules that use it are automatically updated.

## Key Capabilities

- **~15 second detection:** Alerts fire within seconds of a transaction being proposed
- **Classified events:** 9 distinct event types across governance, ERC20, ETH, and contract calls
- **Dual channel:** Email (via Resend) and Slack (via webhook)
- **Recipient lists:** Manage notification groups independently from alert rules
- **Idempotent delivery:** Never get duplicate alerts for the same transaction
- **Per-Safe scoping:** Get alerts only for Safes you care about

## Expected Outcomes

After setting up alerting:
1. Your team knows about every proposed transaction within seconds — not hours or days
2. Governance changes are never made without review
3. Large transfers surface immediately for approval workflows
4. Signers know they're needed without manual coordination
