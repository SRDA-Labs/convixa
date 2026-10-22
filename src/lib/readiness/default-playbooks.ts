export type PlaybookScenario =
  | "signer_compromise"
  | "safe_ui_down"
  | "threshold_unreachable"
  | "malicious_pending_tx"
  | "lost_communications";

export type PlaybookDef = {
  scenario: PlaybookScenario;
  title: string;
  contentMd: string;
};

export const CONVIXA_DEFAULT_PLAYBOOKS: PlaybookDef[] = [
  {
    scenario: "signer_compromise",
    title: "Signer Key Compromise",
    contentMd: `# Signer Key Compromise

## Immediate actions (0–15 min)
1. **Do not sign** any pending transactions from the compromised key.
2. Notify all signers via **out-of-band** channels (not the compromised device).
3. Open a **security incident** in Convixa and link affected Safes.

## Containment (15–60 min)
1. Identify all Safes where the compromised address is a signer.
2. Assess pending transactions — reject or replace any that require the compromised key.
3. If threshold allows, propose **removeOwner** for the compromised address via Safe App.

## Recovery
1. Rotate to a new hardware-backed signer address.
2. Re-verify affiliation for the replacement signer.
3. Complete OOB verification before executing owner removal.
4. Document timeline in incident updates.

## Post-incident
- Run a tabletop drill within 30 days.
- Review signer onboarding checklist completion for remaining roster.`,
  },
  {
    scenario: "safe_ui_down",
    title: "Safe App / Transaction Service Unavailable",
    contentMd: `# Safe App or Transaction Service Down

## Assessment
1. Confirm outage scope (single network vs global).
2. Check [Safe status](https://status.safe.global) and network RPC health.
3. **Do not panic-sign** — pending txs remain in the service queue.

## Workarounds
1. Use alternative Safe interfaces that share the same Transaction Service backend.
2. For execution only: use Safe CLI or direct contract interaction if your org has documented procedures.
3. Maintain an offline signer contact list (from Convixa roster export).

## Communication
1. Post status in org signer channel.
2. Pause non-urgent signing until service restores.

## Recovery
1. Verify pending tx nonces and hashes match pre-outage state.
2. Resume signing with pre-sign checklists.`,
  },
  {
    scenario: "threshold_unreachable",
    title: "Threshold Unreachable (Lost Keys)",
    contentMd: `# Threshold Unreachable — Lost Signer Keys

## Assessment
1. Count remaining reachable signers vs Safe threshold.
2. If reachable signers < threshold: **Safe is frozen** for outbound txs.

## Options
1. **If keys recoverable:** restore hardware wallets / seed backups per key ceremony policy.
2. **If signer permanently lost:** requires remaining signers to execute owner swap/remove if quorum permits.
3. **If quorum impossible:** engage legal/security advisors; document in incident report.

## Prevention
- Maintain hardware wallet inventory in Convixa roster.
- Ensure external security partner signer for treasury Safes.
- Run annual key compromise simulation drill.`,
  },
  {
    scenario: "malicious_pending_tx",
    title: "Malicious or Suspicious Pending Transaction",
    contentMd: `# Malicious or Suspicious Pending Transaction

## Immediate actions
1. **Do not sign.** Notify all signers immediately.
2. Complete **pre-sign checklist** — verify destination, amount, and tx type.
3. Check destination against org blocklists and address lists in Convixa.

## Investigation
1. Identify proposer and signing progress (how many confirmations).
2. Determine if tx is delegatecall, module interaction, or owner change.
3. Open OOB verification case if governance-related.

## Response
1. Reject tx in Safe App if possible.
2. If partially confirmed, coordinate remaining signers to **not** confirm.
3. Report **security incident** (high/critical severity).

## Aftermath
- Review how tx was proposed (compromised proposer key? social engineering?).
- Update checklist templates if a gap was found.`,
  },
  {
    scenario: "lost_communications",
    title: "Communication Channel Compromise",
    contentMd: `# Communication Channel Compromise

## Detection
- Unexpected signing requests in primary chat.
- Impersonation of signers or executives.
- Mismatch between chat instructions and OOB verification.

## Immediate actions
1. **Freeze signing** until identity re-verified.
2. Switch to backup channel (secondary messenger, video call).
3. Use Convixa **OOB verification** workflow for any pending governance tx.

## Verification
1. Video-call confirm signer identities for urgent decisions.
2. Require signed affiliation messages before resuming.
3. Reject any tx approved only via compromised channel.

## Recovery
1. Rotate compromised comms credentials.
2. Update signer onboarding checklist — comms channel item.
3. Log tabletop drill for communications failover.`,
  },
];

export const PLAYBOOK_SCENARIO_LABELS: Record<PlaybookScenario, string> = {
  signer_compromise: "Signer key compromise",
  safe_ui_down: "Safe App / service unavailable",
  threshold_unreachable: "Threshold unreachable",
  malicious_pending_tx: "Malicious pending transaction",
  lost_communications: "Lost / compromised communications",
};
