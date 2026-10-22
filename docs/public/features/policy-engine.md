# Policy Engine & Transaction Controls

## What It Is

The Policy Engine lets you define rules that evaluate every pending transaction against your organization's security requirements. Transactions that match your rules can trigger alerts or be blocked — either off-chain (via notifications) or on-chain (via guard contracts).

Think of it as **programmable security policies for your multisigs**.

## The Problem It Solves

Multisig security relies on humans following rules. But humans make mistakes:
- A signer approves a 100 ETH transfer without checking if it exceeds policy limits
- A transaction interacts with a blacklisted address — but nobody notices
- A signer is added to a Safe without the required approvals from the security team

Even with alerting, you're still relying on someone to see the alert, understand the context, and take action — before the transaction is executed. The Policy Engine automates this judgment.

## How It Works

### Policy Structure

Every policy has three parts:

1. **Trigger** — Which events should this policy evaluate?
   - Specific event types (e.g., ETH_TRANSFER_PROPOSED, SIGNER_ADD_PROPOSED)
   - Specific Safes or all Safes
   - Specific networks

2. **Conditions** — What makes a transaction match?
   - Value thresholds ("transfer exceeds 50 ETH")
   - Address list membership ("recipient is in the approved vendors list")
   - Address list exclusion ("recipient is NOT in the approved vendors list")
   - Safe tags ("Safe is tagged as 'cold wallet'")
   - Network constraints ("transaction is on Ethereum mainnet")

3. **Action** — What happens when conditions match?
   - **Alert** — Send notification to your team
   - **Block** — Flag as a violation (and prevent execution if on-chain guard is deployed)

### Creating a Policy

1. Go to **Controls → Policies**
2. Click **Create Policy**
3. Define your trigger (e.g., "ETH transfers on all Safes")
4. Add conditions (e.g., "value > 50 ETH" AND "recipient not in approved-vendors list")
5. Set the action (e.g., "Alert" or "Block")
6. Test against recent transactions to verify
7. Activate

### Example Policies

**Policy 1: Large Transfer Approval**
```
Trigger: ETH_TRANSFER_PROPOSED on all Safes
Conditions:
  - value > 50 ETH
  - recipient NOT IN "approved-counterparties" list
Action: Alert → Email security team
```
This catches large transfers to new or unapproved addresses before they're executed.

**Policy 2: Governance Change Review**
```
Trigger: SIGNER_ADD_PROPOSED, SIGNER_REMOVE_PROPOSED on all Safes
Conditions:
  - Safe is tagged "cold"
Action: Block
```
Any governance change on cold wallets is flagged as a violation. With an on-chain guard deployed, these changes cannot be executed.

**Policy 3: Token Allowlist**
```
Trigger: ERC20_APPROVAL_PROPOSED on all Safes
Conditions:
  - spender NOT IN "approved-protocols" list
Action: Alert
```
Approvals to unknown protocols are flagged for review.

### Address Lists

Address lists are reusable collections of addresses that you can reference in policies:
- **Vendor lists:** Approved counterparties for payments
- **Protocol lists:** Trusted DeFi protocols for token approvals
- **Blocklists:** Known malicious addresses

Create lists in **Controls → Lists**. Use them across multiple policies — update the list once and all policies reflect the change.

### Testing Policies

Before activating a policy, test it against real transactions:
1. Go to the policy detail page
2. Click **Evaluate**
3. Select a Safe with recent pending transactions
4. See which transactions would have matched (and why)
5. Adjust conditions if needed

## On-Chain Enforcement

Policies can be enforced on-chain by deploying a Safe guard contract. See [On-Chain Policy Deployment](on-chain-policy.md) for details.

When a guard is deployed:
- Transactions that match "Block" policies cannot be executed — even if signers approve them
- The guard contract validates every transaction against your policies before execution
- Policy changes update the guard configuration

## Key Capabilities

- **6 condition types:** Value thresholds, address lists (in/not-in), method matching, network constraints, Safe tags
- **Reusable address lists:** Define once, use across multiple policies
- **Policy testing:** Evaluate policies against real transactions before activation
- **Dual action:** Alert (notify) or Block (prevent)
- **On-chain enforcement:** Deploy guard contracts for programmatic security

## Expected Outcomes

After configuring policies:
1. Large transfers to unapproved addresses trigger immediate alerts
2. Governance changes on critical Safes require explicit review
3. Token approvals are validated against approved protocol lists
4. Your security rules are enforced programmatically — not just by hoping people remember them
