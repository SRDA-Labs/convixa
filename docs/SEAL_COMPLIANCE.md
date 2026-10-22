# SEAL-Aligned Multisig Governance

Convixa helps organizations operate multisigs according to [SEAL Secure Multisig Best Practices](https://frameworks.securityalliance.org/wallet-security/secure-multisig-best-practices/). This document maps SEAL guidance to Convixa features and outlines the implementation roadmap.

**Manual QA:** [SEAL_MANUAL_TEST_CHECKLIST.md](SEAL_MANUAL_TEST_CHECKLIST.md) — step-by-step checklist to verify Phases 1–5.

## Read-only boundary

Convixa is primarily a **visibility and governance** layer. It does **not**:

- Custody private keys
- **Execute** multisig transactions on-chain
- Auto-remediate misconfigurations

**Propose (optional):** From Inventory → Transactions, a connected wallet that is a Safe owner may **propose** owner-management transactions (add / remove / rotate signer) to the Safe Transaction Service. Other owners still confirm and execute in Safe{Wallet}. Convixa never broadcasts an execution.

Users sign and execute in Safe App or other wallets. Convixa detects, documents, scores, alerts, and can optionally help draft owner-change proposals.

## SEAL principles mapped to Convixa

| SEAL area | SEAL guidance (summary) | Convixa today | Roadmap phase |
|-----------|-------------------------|---------------|---------------|
| Thresholds & configuration | Min 3 signers, ~50% threshold, 7+ for $1M+, no N-of-N | Inventory shows M-of-N; compliance scorecard | **Phase 1** |
| Documentation | Document purpose, rules, signers | Safe profile: classification, purpose | **Phase 1** |
| Modules & guards | Avoid unless justified and reviewed | Security attachments card + exception note | **Phase 1** |
| Active monitoring | Monitor proposals, signatures, owner changes | Alerts, poller, config change timeline | **Phase 1** |
| Signer distribution | Diverse roles, no concentration | Signer overlap report | **Phase 1** |
| Signer verification | Affiliation message signing | Phase 2 roster + proofs | — |
| Rotation governance | Document changes, no silent reductions | Config events + critical alerts | **Phase 1** |
| Out-of-band verification | Verify admin changes via multiple channels | OOB case workflow | **Phase 3** |
| Pre-sign verification | Verify raw tx before signing | Checklist + reviews | **Phase 3** |
| Incident reporting | Notify on key loss/compromise | Incident intake + email | **Phase 3** |
| Training & drills | Onboarding checklists, emergency drills | Readiness dashboard, drills, playbooks | **Phase 4** |
| Timelocks / testnet practice | Delays and testnet twins | Governance dashboard, delay detection, twin pairs | **Phase 5** |
| Certification / audit evidence | Documented posture for reviewers | SEAL certification JSON pack | **Phase 5** |

## Phase roadmap

### Phase 0 — Foundation (partial, merged into Phase 1)

- Safe operating profile fields (`classification`, `purpose`, `module_exception_note`)
- Shared compliance evaluation engine

### Phase 1 — Configuration health & monitoring (current)

- Configuration change detection (snapshot diff + executed tx timeline)
- Module/guard inventory from Safe Transaction Service
- SEAL compliance scorecard per safe
- Signer overlap report
- Alert types: `signer_change`, `threshold_decreased`, `signer_count_decreased`, `config_change_critical`

### Phase 2 — Signer accountability (current)

- Signer roster per Safe (auto-synced from on-chain owners)
- Affiliation verification (Safe-scoped, distinct from profile wallet link)
- External signer email invite flow (`/verify-signer/[token]`)
- Admin attestation (exception path with audit)
- Phase 2 SEAL compliance rules (external signer, verification coverage, role diversity)
- EOA activity watch v1 (`ETHERSCAN_API_KEY` + `/api/cron/signer-activity-poll`)
- Security hub: verification coverage, signer activity, roster export

**Detailed plan:** [docs/SEAL_COMPLIANCE_PHASE2.md](SEAL_COMPLIANCE_PHASE2.md)

### Phase 3 — Operational workflows (current)

- Pre-sign verification checklist on pending txs (signer queue + safe detail)
- SEAL default checklist templates (auto-seeded per org)
- Signer review tracking (`pending_tx_reviews`)
- Out-of-band verification cases (auto-open on governance proposals for treasury/protocol safes)
- Security incident intake with `SECURITY_CONTACT_EMAIL` notifications
- Phase 3 compliance rules + alert types (`pending_tx_unreviewed`, `oob_verification_overdue`, `oob_verification_required`, `security_incident_reported`)
- Security hub: Pending reviews, OOB cases, Incidents

**Detailed plan:** [docs/SEAL_COMPLIANCE_PHASE3.md](SEAL_COMPLIANCE_PHASE3.md)

### Phase 4 — Readiness & drills ✅

- Signer onboarding checklists (per org template, per roster progress)
- Emergency drill scheduler + run records + overdue alerts
- Disaster recovery playbook templates (versioned, per classification)
- Emergency readiness dashboard + export pack
- Phase 4 compliance rules on safe scorecards

**Detailed plan:** [docs/SEAL_COMPLIANCE_PHASE4.md](SEAL_COMPLIANCE_PHASE4.md)

### Phase 5 — Advanced governance & certification ✅

- Timelock & execution delay detection (module classifier syncs on snapshot refresh + compliance rules)
- Testnet twin tracking (production ↔ twin safe pairs + drift warnings)
- Safe Transaction Service webhook ingestion (`/api/webhooks/safe-tx-service` + inbox)
- On-chain vs off-chain policy gap report (per safe + org rollup + CSV export)
- Transaction simulation before signing (Tenderly optional; cached per pending tx)
- SEAL certification export pack (structured JSON + CSV summary; `certification:export` permission)
- Security hub: five primary tabs (Readiness, Pending reviews, OOB cases, Incidents); drill-downs linked from Readiness

**Detailed plan:** [docs/SEAL_COMPLIANCE_PHASE5.md](SEAL_COMPLIANCE_PHASE5.md)

## Phase 1 specification

### Schema

**`safes` columns:**

- `classification` — `personal` \| `operational` \| `treasury` \| `protocol_critical`
- `purpose` — required when classification is `treasury` or `protocol_critical`
- `module_exception_note` — justification when non-standard modules are enabled

**`safe_snapshots` columns:**

- `guard_address`, `fallback_handler`, `modules_json`, `last_owners_count`

**`safe_config_events` table:**

Immutable audit of configuration changes with `event_type`, `source` (`executed_tx` \| `pending_proposed` \| `snapshot_diff`), severity, and before/after JSON.

### Compliance rules (Phase 1)

| Rule ID | Status | Logic |
|---------|--------|-------|
| `min_signers_3` | warn/fail | N ≥ 3 for treasury/protocol_critical |
| `threshold_50pct` | warn/fail | threshold ≥ ceil(N/2) |
| `no_n_of_n` | fail | threshold < N |
| `high_value_7_signers` | warn | estimated USD ≥ $1M → N ≥ 7 |
| `modules_documented` | warn | modules present → `module_exception_note` set |
| `classification_set` | warn | classification set for high-value safes |

Balance USD uses native ETH from cached snapshots × `ETH_USD_ESTIMATE` env (default fallback documented in `.env.example`).

### APIs

- `GET /api/safes/[id]/config-events` — configuration change timeline
- `PATCH /api/safes/[id]/profile` — classification, purpose, module exception note
- `GET /api/org/signer-overlap` — org-wide signer concentration report

### UI surfaces

- Safe detail: Compliance scorecard, Security attachments, Config change timeline, Profile form
- Inventory: compliance summary badge per safe
- `/dashboard/security/signer-overlap` — overlap report with CSV export

### Alert types

| Type | Fires when |
|------|------------|
| `signer_change` | Owners differ from last known state |
| `threshold_decreased` | Threshold dropped vs `alert_safe_state` |
| `signer_count_decreased` | Owner count dropped |
| `config_change_critical` | Critical config event in last N hours (default 24) |

## Environment

Optional in `.env`:

```bash
# Rough ETH/USD for compliance asset-band estimates (default: 3000)
ETH_USD_ESTIMATE=3000
```

`SAFE_API_KEY` remains recommended for module/guard fetches and discovery ([Safe API keys](https://docs.safe.global/core-api/how-to-use-api-keys)).

## Related docs

- [README.md](../README.md) — product overview
- [PROJECT_PROGRESS.md](../PROJECT_PROGRESS.md) — changelog
- [src/lib/db/README.md](../src/lib/db/README.md) — schema and migrations
- [SEAL_MANUAL_TEST_CHECKLIST.md](SEAL_MANUAL_TEST_CHECKLIST.md) — manual QA checklist for Phases 1–5
