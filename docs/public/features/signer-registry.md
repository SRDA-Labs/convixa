# Verified Signer Registry

## What It Is

The Verified Signer Registry is an **opt-in cross-organization identity layer** that maps wallet addresses to verified humans. It answers the question that no other tool can: **"Which real person controls this signing address — and across which organizations?"**

## The Problem It Solves

On-chain, multisig signers are just addresses: `0x1234...`. There's no way to know:
- **Who controls that address?** Alice at MyDAO? Bob at ProtocolLabs? An automated bot?
- **Is this address still active?** Did the person leave the organization but keep their signing key?
- **What's their track record?** Have they been reliable? Any security incidents?
- **Are they a signer elsewhere?** If Alice leaves MyDAO, is her address still a signer on Safes at other orgs?

This information gap creates real security risks:
- A departing employee's address stays on 3 Safes across 2 other orgs — nobody rotates the key
- A new signer is added to a Safe — but nobody knows if this address has a history of missed deadlines or security incidents
- During an audit, you can't prove who controlled which address at which point in time

Convixa's Signer Registry fills this gap with cryptographic proof, not trust.

## How It Works

### Registration (Opt-In)

Registration is entirely voluntary. An address is only in the registry if its owner explicitly chooses to register.

1. Go to **Signer Identity** in the sidebar
2. Click **Register in Signer Registry**
3. Connect your wallet (MetaMask, WalletConnect, Ledger, etc.)
4. Sign a SIWE (Sign-In with Ethereum) message — this cryptographically proves you control the private key
5. Optionally set a display name and visibility preference

The SIWE message verifies key control — not identity documents, not KYC. You prove you control `0x1234...` by signing with its private key. No personal documents required.

### Privacy Controls

You control exactly who can see your registry entry:

| Visibility | Who Can See |
|------------|------------|
| **Private** | Only you. Not visible to anyone else. |
| **Orgs Only** (default) | Only organizations where your address is a signer on a Safe |
| **Linked Orgs** | Only organizations you explicitly link |
| **Public** | Anyone using Convixa |

At the "Orgs Only" level, other organizations can see your **aggregate reputation** (score, org count, response rate) but NOT which specific organizations you sign for, your employment status elsewhere, or any internal data from other orgs.

### Reputation Scoring

Convixa computes a 0-100 reputation score based on objective, on-chain data:

| Factor | Impact |
|--------|--------|
| Number of orgs you sign for (3+) | +10 points |
| Response rate (sign within 24h, >90%) | +10 points |
| Recently active (last 7 days) | +10 points |
| Zero security incidents | +10 points |
| Recently verified (within 90 days) | +10 points |
| Dormant (inactive 90+ days) | -20 points |
| Known security incidents | -30 points |
| Employment status "former" | -10 points |

Scores are displayed as reputation badges next to signer addresses throughout Convixa — on Safe detail pages, member lists, and personal dashboards. This builds a portable, verifiable professional identity for multisig signers.

### Cross-Org Offboarding Intelligence

This is the registry's most powerful security feature. Here's the scenario:

1. Alice is a signer on Safes at **MyDAO**, **ProtocolLabs**, and **GrantDAO**
2. Alice leaves MyDAO. MyDAO's admin updates her employment status to "former"
3. **Convixa automatically detects** that Alice's address is still a signer on Safes at ProtocolLabs and GrantDAO
4. **ProtocolLabs and GrantDAO get offboarding alerts:** "A signer on your Safes has been marked as inactive by their organization. Rotate this key."

The alert doesn't reveal which org Alice left or why — only that the address's status changed and rotation is recommended. Cross-org privacy is maintained.

### Org Attestations

Org admins can attest to a signer's employment status at their organization:
- **Active:** Currently employed here
- **Former:** No longer with the organization
- **Leave Announced:** Leaving soon — start planning rotation
- **Unknown:** Employment status not yet verified

When an admin marks a signer as "former," the offboarding alert system activates automatically.

## Key Capabilities

- **SIWE verification:** Cryptographic proof of key control — no KYC required
- **Granular privacy:** Four visibility levels controlled by the signer
- **Reputation scoring:** Objective, on-chain-derived 0-100 score
- **Cross-org alerts:** Automatic notification when a signer's status changes at another org
- **Org attestations:** Admins can verify employment status within their org
- **Audit trail:** Every registration, update, and attestation is logged
- **Portable identity:** Your reputation follows you across organizations

## Expected Outcomes

After adopting the Signer Registry:
1. You know which humans control which signing addresses — not just which addresses
2. When someone leaves an organization, all affected orgs are notified automatically
3. Signers build verifiable, portable professional reputations
4. Audits have cryptographic proof of who controlled which address when
5. Key rotation happens proactively — before it becomes a security incident
