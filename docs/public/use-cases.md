# Use Cases & Scenarios

Real-world examples of how organizations use Convixa to secure their multisig operations.

---

## Scenario 1: The Growing DAO

**Organization:** A DAO with $50M+ in treasury, 12 Safes across 4 chains, and 15 signers.

**Before Convixa:**
- Treasury manager manually checked each Safe on Safe{Wallet} weekly to compile balances
- Signer changes were communicated via Discord — sometimes missed
- A 200 ETH transfer sat in a queue for 4 days because signers didn't know it was proposed
- During an audit, they couldn't produce a complete transaction history across all Safes

**With Convixa:**
- **Inventory:** All 12 Safes added. Balances, signers, and pending transactions visible on one dashboard. Weekly reporting reduced from 3 hours to 5 minutes.
- **Alerting:** Governance change alerts configured. The security team is notified within seconds of any signer addition, removal, or threshold change.
- **Teams:** Treasury team, DeFi team, and Ops team created. Each team sees only their Safes. DeFi signers don't see treasury transactions — treasury signers don't see DeFi positions.
- **Policy Engine:** A "transfers above 50 ETH require security review" policy catches large movements before execution.
- **Audit trail:** Full transaction history exportable for quarterly compliance review.

**Result:** 90% reduction in reporting time. Zero missed governance changes. First audit completed with full documentation.

---

## Scenario 2: The Multi-Protocol Signer

**Persona:** A freelance security engineer who signs for 4 protocols across 7 Safes on 3 chains.

**Before Convixa:**
- Checked Safe{Wallet} for each of 7 Safes individually — several times per day
- Missed a critical transaction because it was on a chain they rarely checked
- Had no way to demonstrate their signing track record to new protocol clients
- Manually tracked what needed signing in a Notion page

**With Convixa:**
- **Personal Dashboard:** All 7 Safes across 4 orgs in one queue. Opens Convixa, sees "3 transactions waiting" — signs them within the hour.
- **My Queue widget:** Quick glance at the dashboard overview shows pending count without opening the full queue.
- **Signer Registry:** Registered all signing addresses. Built a reputation score of 87/100 based on 4 orgs, 98% response rate, zero security incidents.
- **Portable reputation:** When pitching to a 5th protocol, shares their Convixa signer profile as proof of reliability.

**Result:** Response time improved from days to hours. Landed a new protocol client based on verifiable signing reputation. No more missed transactions.

---

## Scenario 3: The Security-Conscious Protocol

**Organization:** A DeFi protocol with $200M TVL, 5 Safes (1 cold, 4 operational), and a dedicated security team.

**Before Convixa:**
- Security team reviewed transactions manually — slow and error-prone
- No automated detection of governance changes on the cold wallet
- A signer left the organization — their address remained on 2 Safes at partner protocols
- No programmatic enforcement of security policies

**With Convixa:**
- **Real-time alerting:** Every transaction on every Safe triggers an alert to the security team's Slack within 15 seconds.
- **Policy engine with on-chain guard:** The cold wallet has a guard deployed. Any governance change or transfer above 10 ETH is blocked on-chain — even if signers approve.
- **Signer Registry with offboarding:** When a team member left, their employment status was updated. Convixa detected they were still a signer at 2 partner protocols and sent offboarding alerts. Both protocols rotated the key within 48 hours.
- **Address lists:** A blocklist of known malicious addresses is maintained. Any transaction interacting with a blocklisted address is flagged and blocked.
- **Audit trail:** Every policy evaluation, alert, and guard deployment is logged.

**Result:** Zero security incidents since deployment. Cold wallet protected by on-chain guard. Offboarding alert caught a cross-org key that would have been missed.

---

## Scenario 4: The Compliance-Ready Enterprise

**Organization:** A regulated enterprise using Safe for treasury management, with external auditors and compliance requirements.

**Before Convixa:**
- Auditors required proof of signer identities and transaction approval workflows
- No centralized record of who controlled which address when
- Manual compilation of transaction history for quarterly reviews
- No way to prove that security policies were consistently enforced

**With Convixa:**
- **Signer Registry:** All signers registered with SIWE verification. Auditors can cryptographically verify who controlled each address.
- **Audit logging:** Every action — Safe addition, signer change, role assignment, policy update — is timestamped and linked to a verified user.
- **Org attestations:** Employment status of each signer is attested by org admins. Auditors can see who was active when.
- **Policy engine:** Policies are documented and tested. Evaluation history shows which transactions were flagged and why.
- **Export:** Full inventory and activity export for compliance reporting.

**Result:** Audit preparation reduced from weeks to hours. First audit passed with zero findings related to multisig management. Compliance team has on-demand access to all required documentation.

---

## Scenario 5: The Incident Response

**Scenario:** A signer's private key is suspected to be compromised.

**Without Convixa:**
- Security team scrambles to identify which Safes the compromised address has access to
- Manual check across Safe{Wallet} for each Safe on each chain
- No way to know if the address is a signer at other organizations
- Hours lost before all affected Safes are identified and keys are rotated

**With Convixa:**
1. **Signer Registry:** Search the compromised address → immediately see every Safe where it's a signer across all orgs
2. **My Safes view:** Full list of affected Safes with thresholds and other signers
3. **Offboarding alerts:** Update employment status to "former" → automatic alerts to all other orgs where this address is a signer
4. **Policy engine:** If set up, governance changes are already being monitored and alerted
5. **Audit trail:** Full history of when this address was added, what it signed, and its activity across orgs

**Result:** Complete incident response within minutes instead of hours. All affected orgs notified automatically. Key rotation completed across all Safes within the same day.
