# Pain Points We Solve

Multisig security is powerful — but operating multisigs at scale is painful. Convixa eliminates the friction that makes Safe management slow, risky, and invisible.

---

## For Treasury Managers

### Pain: "I don't know what's happening across our Safes."
You have Safes on 4 chains, managed by 3 teams. Balances? Pending transactions? Signer changes? You have to open Safe UI for each one — or trust that someone told you.

**Convixa solves this:** One dashboard. Every Safe. Every chain. Real-time balances, pending queues, transaction history. No more logging into Safe UI per chain just to see what's going on.

### Pain: "We only find out about problems after execution."
A signer was added without approval. A 500 ETH transfer went through. A threshold was lowered. By the time anyone notices, it's already on-chain.

**Convixa solves this:** Alerts fire the moment a transaction is proposed — not after it's signed. Governance changes, large transfers, suspicious contract calls — you know before anyone signs.

### Pain: "Auditors and compliance teams ask questions we can't answer."
"Who controlled address 0x1234... on March 15?" "When was this signer added?" "Why wasn't this threshold change reviewed?"

**Convixa solves this:** Full audit trail of every Safe change. Every signer. Every threshold. Every transaction. Exportable, timestamped, and linked to verified identities.

---

## For Security Leads

### Pain: "Suspicious transactions blend in with legitimate ones."
A contract call to an unverified address. A transferFrom that drains tokens. An approval to a suspicious spender. These look just like normal transactions in Safe UI.

**Convixa solves this:** The policy engine classifies every transaction by type and evaluates it against your rules. Transfers above thresholds trigger alerts. Interactions with blocklisted addresses are flagged. Suspicious patterns surface immediately.

### Pain: "Signers leave the org but we don't rotate their keys."
Alice left MyDAO. She's still a signer on 3 Safes at ProtocolLabs and 1 at GrantDAO. Nobody knows — until something goes wrong.

**Convixa solves this:** The Verified Signer Registry tracks which humans control which addresses across organizations. When a signer's employment status changes at one org, every other org where they're still a signer gets an offboarding alert. Key rotation happens proactively, not reactively.

### Pain: "We can't enforce policies on-chain."
You have rules. But they're only enforced by people remembering to follow them. There's no programmatic enforcement.

**Convixa solves this:** Deploy Safe guard contracts that enforce your policies directly on-chain. Transactions that violate your rules cannot be executed — even if signers approve them.

---

## For Multisig Signers

### Pain: "I sign for 3 organizations but have no unified view."
You switch orgs in Safe UI. Log into different chains. Manually track which transactions need your signature. It's friction that slows everyone down.

**Convixa solves this:** The Personal Signer Dashboard shows every pending transaction waiting for your signature — across every org, every chain. One queue. No switching. Just what needs your attention.

### Pain: "My reputation as a signer is invisible."
You've been a reliable signer for 4 protocols over 2+ years. Zero missed deadlines. Zero security incidents. Nobody can see that — it's not recorded anywhere.

**Convixa solves this:** The Signer Registry builds a verifiable reputation score based on your signing activity, response time, and security record. Protocols looking for trusted signers can verify your track record.

### Pain: "I don't know when I'm needed."
Transactions sit in queues because signers don't know they're needed. Hours turn into days. Urgent transactions get delayed.

**Convixa solves this:** The personal queue refreshes automatically. Your dashboard shows exactly what's waiting for you. Alerts notify you when critical transactions need your signature.

---

## For Org Admins

### Pain: "Managing access across teams is manual and error-prone."
Different teams manage different Safes. But Safe itself doesn't have team-level access control. Everyone with the Safe address can see everything — or nothing.

**Convixa solves this:** Teams, roles, and granular permissions. Each team is scoped to specific Safes. Team leads manage their own members. Custom roles define exactly what each person can do. Everything is audit-logged.

### Pain: "Onboarding new members is a process."
Generate invite links. Track who joined. Assign them to teams. Give them the right permissions. It's manual coordination.

**Convixa solves this:** Secure invite links. Role assignment at onboarding. Automatic team placement. New members are productive in minutes, not days.
