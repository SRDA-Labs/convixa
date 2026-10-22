# Frequently Asked Questions

## General

**Q: What is Convixa?**  
Convixa is a security and observability platform for organizations that use Safe multisig wallets. It gives you visibility into every Safe across every chain, real-time alerts on proposed transactions, policy-based security controls, and a verified signer identity layer.

**Q: Does Convixa replace Safe{Wallet}?**  
No. You still use Safe{Wallet} to propose, sign, and execute transactions. Convixa is the observability and security layer on top — it tells you what's happening and whether it's safe, but doesn't replace the Safe itself.

**Q: Do I need to change my Safe contracts to use Convixa?**  
No. Convixa reads data from the Safe Transaction Service API — the same API that powers Safe{Wallet}. No contract changes, no migrations, no on-chain transactions required.

**Q: Does Convixa custody funds or hold private keys?**  
Never. Convixa is read-only for Safe data. You connect your wallet for identity verification (SIWE) and optional on-chain policy deployment, but Convixa never holds your assets or keys.

**Q: Is there a free tier?**  
Yes. The Personal plan is free forever (up to 10 Safes, 10 alert rules). Team organizations get a 14-day free trial with full feature access, then a free tier (5 Safes, 3 members, 3 alerts). Paid plans unlock higher limits and advanced features.

---

## Safe Inventory

**Q: How many chains does Convixa support?**  
Nine: Ethereum, Base, Arbitrum, Polygon, Optimism, Gnosis Chain, Avalanche, BSC, and Sepolia (testnet).

**Q: How often does Safe data refresh?**  
Snapshot data (owners, threshold, balances) refreshes on demand and via the alerting poller every ~15 seconds. You can also manually refresh any Safe at any time.

**Q: Can I add a Safe that's not controlled by my organization?**  
You can add any Safe address — Convixa will fetch its public data from the Safe API. However, you should only add Safes your organization is authorized to monitor.

**Q: How are balances calculated?**  
Balances are fetched live from the Safe Transaction Service API and include native tokens (ETH, MATIC, etc.) and ERC20 tokens. USD values are sourced from CoinGecko price feeds.

---

## Alerting

**Q: How fast are alerts delivered?**  
Typically within 15-30 seconds of a transaction being proposed on-chain. The alerting engine polls every ~15 seconds.

**Q: Can I get Slack notifications?**  
Yes. Configure a Slack webhook URL in your alert rule settings. You can use different webhooks for different rules or Safes.

**Q: Can I alert different people for different Safes?**  
Yes. Each alert rule can be scoped to specific Safes and sent to specific recipients (individual emails, recipient lists, or Slack channels).

**Q: What if the same transaction triggers multiple alerts?**  
The alerting engine is idempotent — you'll never get duplicate alerts for the same transaction, even if it matches multiple rules.

**Q: Can I test an alert before activating it?**  
Yes. Each subscription has a "Test" option that sends a sample alert to verify delivery.

---

## Policy Engine

**Q: What's the difference between "Alert" and "Block" policies?**  
Alert policies notify your team when a transaction matches your rules. Block policies flag the transaction as a violation — and if you've deployed an on-chain guard, the transaction cannot be executed.

**Q: Do I need an on-chain guard for Block policies to work?**  
Block policies always flag violations in the dashboard. To prevent execution on-chain, you need to deploy a guard contract. Without a guard, Block policies serve as strong warnings but don't programmatically prevent execution.

**Q: Can I test a policy before activating it?**  
Yes. The policy detail page has an "Evaluate" option that tests your policy against recent transactions so you can see what would match (and why).

**Q: How many policies can I create?**  
The free tier allows 3 alert rules total (includes alerts and policies). Paid plans allow more. Check your plan's entitlements.

**Q: What are address lists?**  
Address lists are reusable collections of addresses (e.g., approved vendors, trusted protocols, known malicious addresses). You reference them in policies — update the list once and all policies using it are updated.

---

## Signer Registry

**Q: Is the Signer Registry mandatory?**  
No. Registration is entirely opt-in. You only register your address if you want to build cross-org reputation and enable offboarding intelligence.

**Q: Does registration require KYC?**  
No. Registration uses SIWE (Sign-In with Ethereum) — a cryptographic signature that proves you control the private key for an address. No identity documents, no KYC.

**Q: Who can see my registry entry?**  
You control this. Visibility options: Private (only you), Orgs Only (orgs where you're a signer), Linked Orgs (orgs you choose), or Public. The default is "Orgs Only."

**Q: What information is visible to other orgs?**  
At "Orgs Only" visibility: your display name, wallet address, verification status, aggregate reputation score, and org count. Your employment status at other orgs and which specific orgs you sign for are NOT visible.

**Q: What's a reputation score?**  
A 0-100 score based on objective, on-chain factors: number of orgs you sign for, response rate, activity level, and security history. It's designed to be a portable, verifiable professional credential for multisig signers.

**Q: How do offboarding alerts work?**  
When an org admin marks a signer as "former," Convixa checks if that address is still a signer on Safes at other orgs. If so, those orgs get an alert recommending key rotation. The alert doesn't reveal which org the person left.

---

## Personal Dashboard

**Q: Can I link multiple wallets?**  
Yes. You can link multiple signing wallets (e.g., Ledger, MetaMask, work key) to your Convixa profile. Each is verified via SIWE.

**Q: Does my personal queue show transactions from orgs I'm not a member of?**  
Yes — that's the point. If you're a signer on a Safe at an org you're not a Convixa member of, your personal queue will show pending transactions from that Safe. You can see what needs your signature without joining the org.

**Q: Is my personal queue visible to other members of my org?**  
No. Your personal queue is private to you.

---

## Security & Compliance

**Q: Where is data stored?**  
Convixa uses PostgreSQL for all application data. Safe data is fetched from the public Safe Transaction Service API. No sensitive key material is stored.

**Q: Is Convixa audited?**  
Convixa is currently in active development. A formal security audit is planned. Contact us for the latest status.

**Q: Can I export data for compliance?**  
Yes. The Inventory page supports CSV export. The audit log provides a complete record of all actions within your organization.

**Q: What happens if Convixa goes down?**  
Your Safes continue to function normally via Safe{Wallet}. Convixa is a monitoring and security layer — it doesn't gate Safe operations (unless you've deployed an on-chain guard, which operates independently).

---

## Billing & Plans

**Q: What plans are available?**  
Personal (free, up to 10 Safes), Free Team (post-trial, 5 Safes), and Pro/Enterprise (custom limits, all features). See the billing page for current pricing.

**Q: What happens when my trial ends?**  
Your organization reverts to the free tier limits. You won't lose data, but you'll be limited to 5 Safes, 3 members, and 3 alert rules. Upgrade to Pro to restore full access.

**Q: Can I cancel anytime?**  
Yes. Cancel from the Billing page or contact support. You'll retain access until the end of your billing period.

---

**Still have questions?** Reach out to support@convixa.io
