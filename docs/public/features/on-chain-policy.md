# On-Chain Policy Deployment

## What It Is

On-Chain Policy Deployment lets you enforce your Policy Engine rules directly on your Safe via a **guard contract**. When a guard is deployed, transactions that violate your policies cannot be executed — even if signers approve them.

## The Problem It Solves

Off-chain policies (alerts, violations in the dashboard) rely on humans seeing the alert and taking action before execution. This works well for most scenarios, but for high-security use cases, you need **programmatic enforcement**:

- A malicious signer or compromised key could approve a transaction that violates policy
- Social engineering could convince signers to approve something they shouldn't
- Human error — someone approves without checking — bypasses alert-based controls

On-chain guards eliminate these risks. The Safe smart contract itself enforces your rules at execution time.

## How It Works

### Safe Guards

Safe supports **guard contracts** — smart contracts that can check every transaction before it executes. If the guard reverts, the transaction cannot execute — regardless of how many signers approved it.

Convixa deploys a guard contract pre-configured with your policy rules. When a transaction is executed on your Safe:

1. The Safe calls the guard contract's `checkTransaction` or `checkAfterExecution` function
2. The guard evaluates the transaction against your policies
3. If the transaction violates a "Block" policy, the guard reverts — execution fails
4. If the transaction passes all policies, execution proceeds normally

### Deployment

1. Configure your policies in **Controls → Policies** with the "Block" action
2. Go to **Controls → On-Chain Policy**
3. Review the policies that will be enforced on-chain
4. Click **Deploy Guard**
5. Confirm the deployment transaction in your wallet
6. Once deployed, set the guard on your Safe (via Safe{Wallet} or Convixa)

### Policy Updates

When you update your policies in Convixa, the guard contract can be updated to reflect the new rules. This requires a new deployment or guard update transaction.

## What Policies Can Be Enforced On-Chain

| Policy Type | On-Chain Enforceable? | Notes |
|------------|----------------------|-------|
| Value thresholds | Yes | Guard checks `value` parameter |
| Address lists (allowlist/blocklist) | Yes | Guard checks `to` address against on-chain list |
| Method-based restrictions | Yes | Guard checks function selector |
| Governance changes | Yes | Guard checks `to == safeAddress` + selector |
| Network restrictions | N/A | Guard is chain-specific by nature |
| Safe tag rules | No | Tags are off-chain metadata |

## Key Considerations

- **Gas costs:** Each guard check adds gas to transaction execution. Policies are designed to be efficient.
- **Immutability:** Once deployed, a guard's logic is on-chain. Policy updates require a new deployment or guard swap.
- **Guard compatibility:** Convixa guards follow the Safe guard interface. They work with any Safe version that supports guards (v1.3.0+).
- **Multiple Safes:** Each Safe needs its own guard deployment. Policies can be shared across Safes.
- **Removing a guard:** You can remove a guard at any time via Safe{Wallet} by setting the guard address to `0x0`.

## Recommended For

On-chain enforcement is recommended for:
- **Cold wallets / treasury Safes** with high value — where any execution should be policy-gated
- **Compliance-required Safes** — where regulatory requirements demand programmatic controls
- **Safes with large signer sets** — where social verification of every transaction is impractical

Not necessary for:
- Low-value operational Safes with trusted signers
- Safes where off-chain alerting provides sufficient security
- Safes with frequent transactions where gas efficiency is critical

## Key Capabilities

- **Pre-execution validation:** Guard checks every transaction before it executes
- **Policy-driven configuration:** Guard is configured from your existing Convixa policies
- **Standard Safe interface:** Compatible with any Safe v1.3.0+
- **Removable:** Guards can be removed or replaced at any time
- **Multi-Safe:** Deploy guards for individual Safes or share policies across Safes

## Expected Outcomes

After deploying on-chain guards:
1. Transactions that violate your policies cannot be executed — period
2. Your security rules are enforced programmatically, regardless of human decisions
3. Compromised signer keys cannot bypass your policy controls
4. Compliance requirements for programmatic controls are met
5. Your organization has defense-in-depth: alerts catch issues early, guards prevent them on-chain
