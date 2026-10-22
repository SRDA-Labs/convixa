# SEAL Phase 2 — Signer Accountability (Implementation Plan)

This document is the detailed implementation plan for Phase 2 of Convixa's [SEAL-aligned governance](SEAL_COMPLIANCE.md) roadmap. Phase 1 covered configuration health; Phase 2 covers **who** the signers are and **whether they are verified** for each Safe.

Reference: [SEAL Secure Multisig Best Practices](https://frameworks.securityalliance.org/wallet-security/secure-multisig-best-practices/)

---

## Executive summary

| Phase | Question answered |
|-------|-------------------|
| Phase 1 | Is this Safe configured correctly? Did configuration change? |
| **Phase 2** | **Who operates each signer key? Are they verified for this Safe? Is the key used responsibly?** |

Convixa remains **read-only** — no on-chain owner changes, no transaction signing from the app.

### Measurable goals (definition of done)

1. **Roster per Safe** — display name, role, internal/external type, hardware self-report, verification status for every on-chain owner.
2. **Affiliation verification** — cryptographically prove a wallet is an authorized signer for a specific Safe (distinct from SIWE wallet link).
3. **Verification coverage** — org dashboard showing % verified signers on treasury/protocol safes.
4. **SEAL compliance rules** — external signer present, all signers verified, role diversity.
5. **EOA activity watch (v1)** — detect outgoing non-multisig activity on signer addresses.
6. **Export** — roster pack (CSV/JSON) for protocol documentation / audit.

---

## What Phase 1 provides (foundation)

| Asset | Location | Phase 2 extension |
|-------|----------|-------------------|
| Owner addresses | `safe_snapshots.owners` | Auto-seed roster on refresh |
| Safe profile | `safes.classification`, `purpose` | Drives strict verification rules |
| Compliance engine | `src/lib/seal-compliance/` | Phase 2 rules |
| Signer overlap | `src/lib/signer-overlap/analyze.ts` | + verification status columns |
| Wallet link (SIWE) | `signer_wallet_links`, `POST /api/profile/link-wallet` | **Not** the same as Safe affiliation |
| Org members | `org_members` | Link internal signers to users |
| Config events | `safe_config_events` | Link owner removals to roster |
| Security nav | `/dashboard/security/signer-overlap` | Expand to accountability hub |

**Current gap:** On-chain owners are anonymous addresses. SIWE proves a user owns a wallet globally — not that the wallet is an authorized signer for Safe X at Org Y.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA INPUTS                               │
│  safe_snapshots.owners │ org_members │ signer_wallet_links       │
│  block explorer API (EOA activity)                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌───────────┐      ┌─────────────┐     ┌──────────────┐
   │ Roster    │      │ Verification│     │ Activity     │
   │ sync      │─────▶│ affiliation │     │ poller (v1)  │
   │ + match   │      │ proofs      │     │              │
   └─────┬─────┘      └──────┬──────┘     └──────┬───────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
                   ┌──────────────────┐
                   │ seal-compliance  │
                   │ Phase 2 rules    │
                   └────────┬─────────┘
                            ▼
              ┌─────────────────────────────┐
              │ UI, alerts, exports, audit  │
              └─────────────────────────────┘
```

---

## Deliverable 2.1 — Signer roster data model

### Table: `safe_signer_roster`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `org_id` | uuid FK | Tenant isolation |
| `safe_id` | uuid FK | |
| `signer_address` | text | Checksummed; unique with `safe_id` |
| `display_name` | text | Human label |
| `signer_type` | text | `internal` \| `external_advisor` \| `security_partner` \| `unknown` |
| `role_label` | text | e.g. "CTO", "Finance lead" |
| `org_member_user_id` | uuid nullable | Internal match |
| `hardware_wallet` | text nullable | `ledger` \| `trezor` \| `gridplus` \| `software` \| `unknown` |
| `is_dedicated_signer` | boolean nullable | Self-reported |
| `verification_status` | text | `unverified` \| `pending` \| `verified` \| `expired` \| `revoked` |
| `verification_method` | text nullable | `siwe_affiliation` \| `admin_attested` |
| `verified_at` | timestamp nullable | |
| `verified_by_user_id` | uuid nullable | |
| `notes` | text nullable | |
| `source` | text | `snapshot_sync` \| `manual` |
| `removed_at` | timestamp nullable | Soft-delete when owner leaves on-chain |
| `created_at`, `updated_at` | timestamp | |

### Table: `signer_affiliation_proofs` (immutable)

| Column | Purpose |
|--------|---------|
| `roster_id`, `org_id`, `safe_id`, `signer_address` | Scope |
| `message_text`, `message_hash`, `signature` | Proof |
| `signed_by_user_id` | Submitter |
| `verified_at`, `expires_at` | Optional annual re-verify |

### Table: `signer_verification_requests`

For external signers without Convixa accounts: email invite + magic link token.

| Column | Purpose |
|--------|---------|
| `roster_id`, `email`, `token_hash`, `expires_at` | Invite |
| `status` | `pending` \| `completed` \| `expired` \| `revoked` |
| `created_by_user_id` | Admin |

### Table: `signer_eoa_activity` (Deliverable 2.5)

| Column | Purpose |
|--------|---------|
| `signer_address`, `network` | Key |
| `last_checked_at`, `last_outgoing_tx_at`, `last_outgoing_tx_hash` | |
| `activity_count_7d` | Rolling window |
| `raw_summary` | json |

**Migration:** `drizzle/0002_seal_phase2.sql`

**Repository:** `src/lib/db/repositories/safe-signer-roster.repository.ts`

---

## Deliverable 2.2 — Roster sync & identity matching

### Sync hook

Extend `writeSafeSnapshot()` in `src/lib/safe-config/snapshot-write.ts`:

1. **Upsert** roster row for each owner (`source: snapshot_sync`, `verification_status: unverified` if new).
2. **Soft-remove** roster rows whose address no longer in owners (`removed_at` set).
3. Emit audit-friendly link to `safe_config_events` when owner set changes.

Do **not** delete affiliation proofs when owner removed — retain for audit.

### Identity matcher: `src/lib/signer-roster/identity-matcher.ts`

| Source | Match | Action |
|--------|-------|--------|
| `signer_wallet_links` for org members | Address match | Suggest `org_member_user_id` |
| `users.linked_wallet_address` | Legacy | Same |

**Never auto-assign** org member without admin confirm.

**API:** `GET /api/safes/[id]/roster/suggestions`

### Permissions

| Action | Permission |
|--------|------------|
| View roster | `safes:read` + team access |
| Edit metadata | `canManageTeam(safe.teamId)` |
| Request verification | `canManageTeam` |
| Admin attestation | org admin only |
| Self-verify | User with linked wallet = `signer_address` |

---

## Deliverable 2.3 — Affiliation verification

SEAL: *Signers should verify their addresses by signing a message stating affiliation and the multisig they intend to join.*

### Message template (EIP-191)

`src/lib/signer-roster/affiliation-message.ts`:

```
I affirm that {signerAddress} is operated by {displayName} ({roleLabel})
affiliated with {orgName} as a signer on Safe {safeAddress} ({network}).

Purpose: {safePurpose}
Request ID: {requestId}
Issued: {isoTimestamp}
Expires: {expiresAt}
```

- Server-issued `requestId` / nonce — separate from `users.pendingWalletNonce`.
- Exact byte match on verify.

### Flow A — Internal signer (Convixa account)

1. Admin → Request verification on roster row.
2. Signer → in-app notification.
3. Signer → `GET .../affiliation-challenge` → wallet `personal_sign`.
4. Signer → `POST .../verify-affiliation` → proof stored, status `verified`.

### Flow B — External signer (no account)

1. Admin → email + display name → verification request row.
2. Resend email → `/verify-signer/[token]` public page.
3. Connect wallet (must match roster address) → sign → submit.

### Flow C — Admin attestation (exception)

- Org admin sets `verification_method: admin_attested` + required notes (min 20 chars).
- Audit: `signer.attestation`.
- Compliance: counts as **warn** tier, not full **pass**, on protocol-critical safes.

### APIs

| Method | Path |
|--------|------|
| GET | `/api/safes/[id]/roster` |
| POST | `/api/safes/[id]/roster` |
| PATCH | `/api/safes/[id]/roster/[rosterId]` |
| DELETE | `/api/safes/[id]/roster/[rosterId]` (manual only) |
| POST | `/api/safes/[id]/roster/[rosterId]/request-verification` |
| GET | `/api/safes/[id]/roster/[rosterId]/affiliation-challenge` |
| POST | `/api/safes/[id]/roster/[rosterId]/verify-affiliation` |
| POST | `/api/safes/[id]/roster/[rosterId]/attest` |
| GET/POST | `/api/verify-signer/[token]` (public) |

---

## Deliverable 2.4 — Phase 2 compliance rules

Extend `src/lib/seal-compliance/rules.ts`:

| Rule ID | Logic |
|---------|-------|
| `external_signer_present` | Treasury/protocol: ≥1 `external_advisor` or `security_partner` |
| `all_signers_verified` | All roster rows verified (attestation = warn) |
| `role_diversity` | ≥2 distinct `role_label` when N ≥ 3 |
| `no_unknown_signers` | No `signer_type: unknown` on treasury+ |
| `dedicated_signer_declared` | Warn if `is_dedicated_signer === false` on protocol_critical |
| `hardware_wallet_majority` | Warn if >50% report `software` on treasury+ |

Extend `ComplianceInput` with `roster[]` array.

Update callers: safe detail page, inventory page.

---

## Deliverable 2.5 — Non-multisig activity watch (v1)

SEAL: *Monitor signing wallets for activity not related to multisig operations.*

### Scope

- Monitor roster addresses on networks where org has safes.
- Block explorer API (Etherscan-class): `ETHERSCAN_API_KEY` in `.env`.
- Cache in `signer_eoa_activity`; poll from cron (rate-limited).

### Heuristic

- Flag **outgoing EOA txs** in last 7 days.
- Best-effort exclude obvious Safe service patterns; document false positives.

### Alert: `signer_eoa_activity`

Config: `{ lookbackDays: 7, minOutgoingCount: 1 }`

### v1 limitations (document explicitly)

- Cannot distinguish Safe Mobile vs personal transfer with 100% accuracy.
- v2: correlate with Safe Transaction Service confirmation events.

---

## Deliverable 2.6 — UI surfaces

### Safe detail — Signer Roster

`src/app/dashboard/safes/[id]/`:

- `signer-roster-table.tsx` — enriched signers (replaces raw address list).
- `signer-roster-edit-modal.tsx`
- `verify-affiliation-banner.tsx` — for logged-in user with matching linked wallet.

### Security hub sub-routes

| Route | Purpose |
|-------|---------|
| `/dashboard/security/signer-overlap` | Phase 1 + verification columns |
| `/dashboard/security/verification` | Org verification coverage |
| `/dashboard/security/signer-activity` | EOA activity list |
| `/dashboard/security/roster-export` | Export center |

### Teams integration

Members tab: linked wallet count, link to signer's safes.

### Notifications

- `signer_verification_requested`
- `signer_verification_completed`

---

## Deliverable 2.7 — Alerts, exports, audit

### New alert types

| Type | Fires when |
|------|------------|
| `unverified_signers` | Unverified owners on treasury+ safes |
| `missing_external_signer` | No external type on treasury/protocol |
| `signer_eoa_activity` | Outgoing EOA activity in window |
| `verification_expiring` | Proof age > threshold (default 365d) |

### Policy templates

- SEAL: Unverified signer on treasury Safe
- SEAL: Missing external signer

### Export

`GET /api/org/signer-roster-export?format=csv|json`

### Audit actions

`signer.roster.create`, `signer.roster.update`, `signer.verification.request`, `signer.verification.complete`, `signer.attestation`

---

## Security & privacy

| Topic | Approach |
|-------|----------|
| External email PII | Minimal storage; hashed tokens; expiry |
| Proofs | Message + signature only |
| Admin attestation | Admin-only; audit; lower compliance tier |
| Cross-org | All queries filter `org_id` |
| Public verify page | Rate limit; single-use token |

---

## Testing strategy

| Area | Approach |
|------|----------|
| Affiliation message | Snapshot: stable template bytes |
| Verify API | Valid/invalid sig, wrong address, expired nonce |
| Roster sync | Add/remove owners |
| Compliance | external_signer, all_signers_verified |
| API auth | Member cannot attest; lead can edit |
| Activity poller | Mock explorer responses |

---

## Sprint plan (4 weeks)

### Sprint A — Roster foundation
- Migration + repository
- Roster sync in `writeSafeSnapshot`
- GET/PATCH roster API
- Safe detail roster table (read-only)

### Sprint B — Verification
- Affiliation message + nonces
- Internal verify flow
- External email + public page
- Admin attestation + audit

### Sprint C — Compliance & hub
- Phase 2 SEAL rules
- Verification coverage dashboard
- Overlap report enrichment
- Inventory/scorecard updates

### Sprint D — Activity & polish
- EOA activity poller
- Alerts + activity page
- Roster export
- Documentation

---

## Out of scope (Phase 3+)

- Onboarding checklists / drills (Phase 4)
- Cross-org reputation registry
- Perfect Safe-vs-personal tx classification (Phase 2 v1 limitation; improved in Phase 5)

---

## Risks

| Risk | Mitigation |
|------|------------|
| External signers skip verify | Admin attestation + export for manual docs |
| Explorer rate limits | 24h cache; prioritize treasury |
| Roster vs on-chain drift | Snapshot sync is address source of truth |
| SIWE vs affiliation confusion | Separate UX copy and flows |
| No Resend | In-app only for internal; warn on email invite |

---

## Documentation updates (on ship)

- `docs/SEAL_COMPLIANCE.md` — Phase 2 summary + link here
- `README.md` — signer roster feature
- `.env.example` — `ETHERSCAN_API_KEY`, `AFFILIATION_PROOF_TTL_DAYS`
- `src/lib/db/README.md` — new tables
- `PROJECT_PROGRESS.md` — changelog
- `docs/DEPLOYMENT.md` — cron load note
