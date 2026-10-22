# Database Layer - Production-Grade Structure

## Overview

This directory contains a production-grade database layer with proper separation of concerns:

```
db/
├── schema/              # Modular schema definitions by domain
│   ├── orgs.schema.ts
│   ├── users.schema.ts
│   ├── teams.schema.ts
│   ├── roles.schema.ts
│   ├── safes.schema.ts
│   ├── alerts.schema.ts
│   ├── subscription-lists.schema.ts   # alert email lists (not billing)
│   ├── invites.schema.ts
│   ├── audit.schema.ts
│   ├── policies.schema.ts
│   ├── address-lists.schema.ts
│   ├── blocklist.schema.ts
│   ├── safe-blacklist-checks.schema.ts
│   ├── signer-wallets.schema.ts
│   ├── transaction-history.schema.ts
│   ├── safe-config-events.schema.ts
│   ├── safe-signer-roster.schema.ts
│   └── index.ts
├── repositories/        # Data access layer with reusable operations
│   ├── safes.repository.ts
│   ├── teams.repository.ts
│   ├── orgs.repository.ts
│   ├── users.repository.ts
│   ├── alerts.repository.ts
│   ├── subscription-lists.repository.ts
│   ├── policies.repository.ts
│   ├── address-lists.repository.ts
│   ├── audit.repository.ts
│   ├── safe-config-events.repository.ts
│   ├── safe-signer-roster.repository.ts
│   └── index.ts
├── utils/              # Database utilities
│   ├── transactions.ts
│   └── queries.ts
├── types/              # TypeScript types and interfaces
│   └── index.ts
├── index.ts            # Main database export
├── schema.ts           # Legacy compatibility (re-exports from schema/)
└── README.md          # This file
```

## Migrations

Migrations are stored in the `drizzle/` directory at the project root.

**Commit `drizzle/meta/`** (including `_journal.json` and snapshot JSON) together with migration SQL files. `drizzle-kit migrate` uses the journal to know which `.sql` files to run; Docker full-stack startup runs `npx drizzle-kit migrate` and expects this metadata to be present in the image.

**`0000_oss_baseline`** — single squashed migration for the open-source product (June 2026). Creates 33 tables only (no billing, admin portal, join requests, signer registry/reputation, shared-list marketplace, or freemium columns).

**`0001_seal_phase1`** — SEAL compliance Phase 1: `safes.classification`, `purpose`, `module_exception_note`; `safe_snapshots` guard/module columns; `safe_config_events` table. See [docs/SEAL_COMPLIANCE.md](../../docs/SEAL_COMPLIANCE.md).

**`0002_seal_phase2`** — SEAL Phase 2 signer accountability: `safe_signer_roster`, `signer_affiliation_proofs`, `signer_verification_requests`, `signer_eoa_activity`. Repository: `safe-signer-roster.repository.ts`.

**`0007_incident_tracking`** — `security_incident_participants`, `security_incident_activity` for per-incident collaborators and audit-style activity log. Detail UI at `/dashboard/security/incidents/[id]`.

**`0008_pending_tx_threads`** — `pending_tx_threads`, `pending_tx_thread_comments`, `pending_tx_thread_activity`, `pending_tx_thread_participants` for team-scoped discussion records on queued multisig txs. Team hub **Proposals** tab; detail at `/dashboard/teams/proposals/[threadId]`. Start via **Start a discussion** on `/dashboard/safes/[id]/pending/[safeTxHash]/discussion` (explicit create, not auto-open).

**`0003_seal_phase3`** — SEAL Phase 3 operational workflows: `checklist_templates`, `pending_tx_reviews`, `oob_verification_cases`, `oob_verification_evidence`, `oob_verification_confirmations`, `security_incidents`, `security_incident_updates`. Repository: `operational-workflows.repository.ts`. Incident tracking helpers: `src/lib/incidents/`.

**`0004_seal_phase4`** — SEAL Phase 4 readiness: `signer_onboarding_templates`, `signer_onboarding_progress`, `emergency_drill_schedules`, `emergency_drill_runs`, `disaster_recovery_playbooks`, `readiness_snapshots`. Repository: `readiness.repository.ts`. See [docs/SEAL_COMPLIANCE_PHASE4.md](../../docs/SEAL_COMPLIANCE_PHASE4.md).

**`0005_seal_phase5`** — SEAL Phase 5 governance: `safe_delay_attachments`, `org_governance_settings`, `safe_environment_pairs`, `safe_webhook_subscriptions`, `webhook_event_inbox`, `tx_simulation_cache`, `certification_exports`. Repository: `governance.repository.ts`. See [docs/SEAL_COMPLIANCE_PHASE5.md](../../docs/SEAL_COMPLIANCE_PHASE5.md).

**`0006_address_list_contacts`** — Address list entries gain `label`, `notes`, `tags` for named directory contacts; list type `watchlist` for address-only policy sets. Helpers: `src/lib/address-lists/constants.ts`, `parse-import.ts`.

**Address lists vs subscription lists:** `address_lists` / `address_list_entries` store on-chain addresses (directories + watchlists). `subscription_lists` / `subscription_list_members` store **email** recipients for alert notifications — different purpose.

**Checklist templates:** Default Convixa templates are synced per org via `syncDefaultChecklistTemplates()` — one row per Safe tx type (`tx_categories` JSON array, e.g. `["NATIVE_TRANSFER"]`). Classification uses `src/lib/pre-sign-checklist/tx-types.ts` (`classifySafeTransaction`) from Safe API multisig fields.

**Upgrading from pre-OSS databases:** Drop and recreate the database (or `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`) then run `npm run db:migrate`. There is no incremental migration from the old SaaS schema — data in removed tables is not preserved.

### Generating Migrations

After making schema changes:

```bash
npm run db:generate
```

This creates or updates migration files under `drizzle/` and updates `drizzle/meta/` to match. Commit both the new SQL and the `meta/` changes.

### Applying Migrations

To apply pending migrations:

```bash
npm run db:migrate
```

### Development (Schema Push)

For rapid development without migration files:

```bash
npm run db:push
```

**⚠️ Warning:** `db:push` directly syncs schema to database without migration history. Use only in development.

## Repositories

Repositories provide a clean abstraction over database operations. Always use repositories in your API routes instead of raw SQL queries.

### Benefits

- **Modularity**: Encapsulated database logic
- **Reusability**: Common operations defined once
- **Type Safety**: Full TypeScript support
- **Testability**: Easy to mock for unit tests
- **Maintainability**: Changes in one place
- **Error Handling**: Consistent error patterns

### Usage Examples

#### Creating a Safe

```typescript
import { createSafe } from "@/lib/db/repositories";

const safe = await createSafe({
  orgId: "...",
  teamId: "...",
  address: "0x...",
  network: "ethereum",
  name: "Treasury Safe",
  tags: ["finance", "multisig"],
  notes: "Main treasury wallet"
});
```

#### Getting Safes by Team

```typescript
import { getSafesByTeams } from "@/lib/db/repositories";

const safes = await getSafesByTeams(["team-id-1", "team-id-2"]);
```

#### Counting Safes in Organization

```typescript
import { countSafesByOrg } from "@/lib/db/repositories";

const count = await countSafesByOrg(orgId);
```

#### Creating a User

```typescript
import { createUser } from "@/lib/db/repositories";

const user = await createUser({
  email: "user@example.com",
  name: "John Doe",
  passwordHash: await hash(password, 10),
});
```

#### Checking Org Membership

```typescript
import { isOrgMember, isOrgAdmin } from "@/lib/db/repositories";

const isMember = await isOrgMember(userId, orgId);
const isAdmin = await isOrgAdmin(userId, orgId);
```

## Transactions

Use transaction helpers for operations that need atomicity:

### Simple Transaction

```typescript
import { withTransaction } from "@/lib/db/utils/transactions";
import { createUser, addOrgMember } from "@/lib/db/repositories";

const result = await withTransaction(async (tx) => {
  const user = await tx.insert(users).values({...}).returning();
  const member = await tx.insert(orgMembers).values({...}).returning();
  return { user, member };
});
```

### Multiple Operations

```typescript
import { transactional } from "@/lib/db/utils/transactions";

const [user, org, team] = await transactional(
  (tx) => createUser(userData, tx),
  (tx) => createOrg(orgData, tx),
  (tx) => createTeam(teamData, tx)
);
```

## Schema Organization

Schemas are organized by domain for better maintainability:

- **orgs.schema.ts**: Organizations and entitlements
- **users.schema.ts**: Users, OTP codes, NextAuth tables
- **teams.schema.ts**: Teams and team membership
- **roles.schema.ts**: Custom roles and org membership
- **safes.schema.ts**: Safes and cached snapshots
- **alerts.schema.ts**: Alert rules and safe state
- **invites.schema.ts**: Email invitations
- **audit.schema.ts**: Audit logs (org and admin)

## API Route Patterns

### Before (Inline Queries)

```typescript
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  
  // Inline query - harder to test and reuse
  const [safe] = await db
    .insert(safes)
    .values({
      orgId: session.user.orgId,
      teamId: data.teamId,
      address: data.address.toLowerCase(),
      network: data.network,
      name: data.name ?? null,
      tags: data.tags ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  return NextResponse.json({ safe });
}
```

### After (Repository Pattern)

```typescript
import { createSafe } from "@/lib/db/repositories";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  
  // Clean, reusable repository call
  const safe = await createSafe({
    orgId: session.user.orgId,
    teamId: data.teamId,
    address: data.address,
    network: data.network,
    name: data.name,
    tags: data.tags,
    notes: data.notes,
  });

  if (!safe) {
    return NextResponse.json({ error: "Failed to create safe" }, { status: 500 });
  }

  return NextResponse.json({ safe });
}
```

## Available Repositories

### Safes Repository

- `createSafe(data)` - Create a new Safe
- `getSafeById(safeId)` - Get Safe by ID
- `getSafeByAddress(orgId, address, network)` - Get Safe by address
- `getSafesByTeams(teamIds)` - Get Safes for teams
- `getSafesByOrg(orgId)` - Get all Safes in org
- `countSafesByOrg(orgId)` - Count Safes in org
- `updateSafe(safeId, data)` - Update Safe
- `deleteSafe(safeId)` - Delete Safe
- `upsertSafeSnapshot(data)` - Create/update snapshot
- `getLatestSnapshot(safeId)` - Get latest snapshot
- `safeExistsInOrg(orgId, address, network)` - Check existence

### Teams Repository

- `createTeam(data)` - Create a new Team
- `getTeamById(teamId)` - Get Team by ID
- `getTeamsByOrg(orgId)` - Get all Teams in org
- `updateTeam(teamId, data)` - Update Team
- `deleteTeam(teamId)` - Delete Team
- `addTeamMember(data)` - Add user to team
- `removeTeamMember(teamId, userId)` - Remove user from team
- `getTeamMembers(teamId)` - Get all team members
- `getUserTeams(userId)` - Get user's teams
- `isTeamMember(teamId, userId)` - Check membership
- `isTeamLead(teamId, userId)` - Check if user is lead

### Orgs Repository

- `createOrg(data)` - Create a new Organization
- `getOrgById(orgId)` - Get Org by ID
- `getOrgBySlug(slug)` - Get Org by slug
- `getActiveOrgs()` - Get all active orgs
- `getAllOrgs()` - Get all orgs
- `updateOrg(orgId, data)` - Update Org
- `deleteOrg(orgId)` - Soft-delete Org
- `addOrgMember(data)` - Add member to org
- `removeOrgMember(orgId, userId)` - Remove member
- `getOrgMembers(orgId)` - Get all org members
- `getUserOrgMembership(userId, orgId)` - Get membership
- `countOrgMembers(orgId)` - Count members
- `isOrgAdmin(userId, orgId)` - Check if admin
- `isOrgMember(userId, orgId)` - Check if member

### Users Repository

- `createUser(data)` - Create a new User
- `getUserById(userId)` - Get User by ID
- `getUserByEmail(email)` - Get User by email
- `updateUser(userId, data)` - Update User
- `deleteUser(userId)` - Delete User
- `userExistsByEmail(email)` - Check existence
- `enable2FA(userId)` - Enable 2FA
- `disable2FA(userId)` - Disable 2FA
- `getAppAdmins()` - Get all app admins

### Alerts Repository

- `createAlertRule(data)` - Create Alert Rule
- `getAlertRuleById(ruleId)` - Get rule by ID
- `getAlertRulesByOrg(orgId)` - Get org's rules
- `getAlertRulesForSafe(safeId, orgId)` - Get rules for Safe
- `updateAlertRule(ruleId, data)` - Update rule
- `deleteAlertRule(ruleId)` - Delete rule
- `upsertAlertSafeState(data)` - Upsert safe state
- `getAlertSafeState(safeId)` - Get safe state

### Audit Repository

- `createAuditLog(data)` - Create audit log
- `getAuditLogsByOrg(orgId, options)` - Get org's logs
- `getAuditLogsByUser(userId, options)` - Get user's logs
- `createAdminAuditLog(data)` - Create admin log
- `getAdminAuditLogs(options)` - Get admin logs
- `getAdminAuditLogsByUser(adminUserId, options)` - Get admin's logs

## Query Utilities

Common query patterns are available in `utils/queries.ts`:

```typescript
import { parseCount, firstOrNull, exists } from "@/lib/db/utils/queries";

// Parse count from SQL
const count = parseCount(result);

// Get first result or null
const user = firstOrNull(results);

// Check if records exist
const hasRecords = exists(results);
```

## Best Practices

1. **Always use repositories** in API routes instead of raw queries
2. **Use transactions** for multi-step operations
3. **Check for null** results from repository functions
4. **Add new operations** to repositories, not inline in routes
5. **Keep repositories focused** - one repository per domain
6. **Document complex queries** with comments
7. **Use TypeScript types** from schema for type safety
8. **Generate migrations** after schema changes
9. **Test repositories** independently from API routes
10. **Handle errors gracefully** in repositories

## Migration Strategy

For production deployment:

1. **Always generate migrations** for schema changes
2. **Review migration SQL** before applying
3. **Test migrations** on staging first
4. **Backup database** before applying migrations
5. **Run migrations** as part of deployment pipeline
6. **Never use `db:push`** in production

## Backwards Compatibility

The old `schema.ts` file still works for backwards compatibility - it re-exports from the new modular structure. Existing code will continue to work, but new code should import from the repositories.

```typescript
// Old (still works)
import { db, safes } from "@/lib/db";
await db.insert(safes).values({...});

// New (preferred)
import { createSafe } from "@/lib/db/repositories";
await createSafe({...});
```
