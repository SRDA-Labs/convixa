# SEAL Phases 1–5 — Manual Test Checklist

Use this checklist to confirm Convixa’s SEAL-aligned governance features work end-to-end.

**Source plans:** [SEAL_COMPLIANCE.md](SEAL_COMPLIANCE.md), [SEAL_COMPLIANCE_PHASE2.md](SEAL_COMPLIANCE_PHASE2.md), [SEAL_COMPLIANCE_PHASE3.md](SEAL_COMPLIANCE_PHASE3.md), [SEAL_COMPLIANCE_PHASE4.md](SEAL_COMPLIANCE_PHASE4.md), [SEAL_COMPLIANCE_PHASE5.md](SEAL_COMPLIANCE_PHASE5.md)

**How to use:** Work top-to-bottom. Mark `[x]` when pass, `[ ]` when fail, `[-]` when skipped. Log failures with URL, user role, and error text.

---

## 0. Prerequisites

| # | Check | Pass |
|---|-------|------|
| 0.1 | App runs and you can log in | [ ] |
| 0.2 | Migrations through `0005_seal_phase5` applied (`npm run db:migrate`) | [ ] |
| 0.3 | Org with ≥1 Safe (ideally treasury or protocol_critical) | [ ] |
| 0.4 | `SAFE_API_KEY` set | [ ] |
| 0.5 | Optional: `SIGNER_QUEUE_DEV_SIMULATE=true` for checklist testing without on-chain pending txs | [ ] |
| 0.6 | Optional: `ETHERSCAN_API_KEY`, `TENDERLY_*`, `SAFE_WEBHOOK_BASE_URL` | [ ] |

### Test personas

| Persona | Expected access |
|---------|-----------------|
| **Org Admin** | Full access |
| **Security Lead** (`security-lead` role) | Security hub + `certification:export` |
| **Signer** (`signer` role) | Signer Queue only — no Security hub admin |
| **Member** (no custom role) | `safes:read` + `signer:workflow` |

| # | Check | Pass |
|---|-------|------|
| 0.7 | Signer and Security Lead roles exist under **Teams → Roles** | [ ] |
| 0.8 | Test users assigned to each role | [ ] |

---

## 1. Phase 1 — Configuration health

| # | Steps | Expected | Pass |
|---|-------|----------|------|
| 1.1 | Inventory → Safe detail loads | Threshold, owners, balances visible | [ ] |
| 1.2 | Set classification `treasury` + purpose | Saves | [ ] |
| 1.3 | Compliance scorecard on strict Safe | Pass/warn/fail rules shown | [ ] |
| 1.4 | Security attachments card after refresh | Guard/modules listed | [ ] |
| 1.5 | Config change timeline | Events listed | [ ] |
| 1.6 | Security → Signer overlap | Report loads + export | [ ] |

---

## 2. Phase 2 — Signer accountability

| # | Steps | Expected | Pass |
|---|-------|----------|------|
| 2.1 | Safe detail → Signer roster | One row per owner | [ ] |
| 2.2 | Refresh after on-chain owner change | Roster syncs | [ ] |
| 2.3 | Request + complete affiliation verify (internal) | Status → verified | [ ] |
| 2.4 | External verify via `/verify-signer/[token]` | Works with matching wallet | [ ] |
| 2.5 | Admin attestation with notes | Verified via attestation | [ ] |
| 2.6 | Security → Verification / Signer activity / Export | Pages load; exports download | [ ] |

---

## 3. Phase 3 — Operational workflows

| # | Steps | Expected | Pass |
|---|-------|----------|------|
| 3.1 | Security → Checklists | Default templates listed | [ ] |
| 3.2 | Signer Queue → open checklist on pending tx | Auto + manual items work | [ ] |
| 3.3 | Complete review + signing note | Persists for org | [ ] |
| 3.4 | Security → Pending reviews matrix | Loads + CSV export | [ ] |
| 3.5 | Security → OOB cases: open, evidence, confirm, verify | Workflow completes | [ ] |
| 3.6 | Security → Incidents: report + triage | Incident created; email if configured | [ ] |

---

## 4. Phase 4 — Readiness & drills

| # | Steps | Expected | Pass |
|---|-------|----------|------|
| 4.1 | Security → Onboarding | Template + per-signer progress | [ ] |
| 4.2 | Security → Drills: schedule + log completion | Run recorded | [ ] |
| 4.3 | Security → Playbooks | 5 defaults; edit creates new version | [ ] |
| 4.4 | Security → Readiness | KPIs load; CSV export works | [ ] |
| 4.5 | Phase 4 rules on safe scorecard | Onboarding/drill/playbook rules appear | [ ] |

---

## 5. Phase 5 — Advanced governance (API only; no Security hub tab)

| # | Steps | Expected | Pass |
|---|-------|----------|------|
| 5.1 | Refresh Safe → delay detection on scorecard | `timelock_present` rule evaluates | [ ] |
| 5.2 | Policy gap via API `GET /api/org/policy-gap` | JSON report | [ ] |
| 5.3 | Optional: Tenderly simulation API | Skips gracefully if not configured | [ ] |

---

## 6. RBAC

| # | Steps | Expected | Pass |
|---|-------|----------|------|
| 6.1 | Signer user: no Security hub tabs | Redirected from `/dashboard/security/*` | [ ] |
| 6.2 | Security Lead: all Security tabs + manage actions | Full access | [ ] |
| 6.3 | Teams → Roles permission matrix | Grid with tooltips | [ ] |
| 6.4 | Signer cannot access removed governance/certification URLs | Redirects to Readiness | [ ] |

---

## 7. Exports smoke test (Security Lead)

| Export | Pass |
|--------|------|
| Roster CSV | [ ] |
| Rotation CSV | [ ] |
| Pending reviews CSV | [ ] |
| Readiness CSV | [ ] |
| Policy gap CSV | [ ] |

---

## 8. Known limitations (skip if not configured)

- Tenderly / webhooks need env vars
- Pending tx matrix may under-count multi-nonce queues
- OOB evidence is links/text only (no file upload)

---

## 9. Sign-off

| Area | Pass |
|------|------|
| Phase 1 | [ ] |
| Phase 2 | [ ] |
| Phase 3 | [ ] |
| Phase 4 | [ ] |
| Phase 5 | [ ] |
| RBAC | [ ] |

**Date / tester / environment:** _______________
