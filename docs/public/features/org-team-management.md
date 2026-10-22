# Organization & Team Management

## What It Is

Convixa's organization management layer gives you structured access control for your multisig operations. Create teams scoped to specific Safes, assign granular roles and permissions, and manage members through secure invite links — all with a complete audit trail.

## The Problem It Solves

Safe itself has no concept of teams or roles. Anyone who knows a Safe's address can view it on a block explorer. Within an organization, you need:

- **Scoped access:** The DeFi team should see DeFi Safes. The ops team should see ops Safes. Neither should see everything.
- **Granular permissions:** Some people should only view Safes. Others should add/remove them. Only admins should manage members and invites.
- **Member lifecycle:** Onboarding new members, assigning them to teams, and offboarding when they leave should be structured — not ad-hoc.
- **Audit trail:** Every action — who added which Safe, who changed which role, who invited whom — should be recorded.

## How It Works

### Organization Structure

```
Organization (MyDAO)
├── Default Team (all Safes)
├── Treasury Team (treasury Safes only)
│   ├── Alice (lead) — manages team members + Safes
│   ├── Bob (member) — view only
│   └── Carol (member) — view only
├── DeFi Team (protocol Safes only)
│   ├── Dave (lead)
│   └── Eve (member)
└── Ops Team (operational Safes only)
    └── Frank (lead)
```

### Roles & Permissions

Convixa has a three-tier permission model:

**Org-Level Roles:**

| Role | Access |
|------|--------|
| **Owner** | Full org access. Cannot be removed if last owner. Can transfer ownership. |
| **Admin** | Full org access. All permissions implicitly. Manage members, teams, invites, Safes, and billing. |
| **Member** | Permissions defined by assigned custom role |

**Custom Roles:** Create named roles with specific permission sets:

| Permission | What It Allows |
|-----------|---------------|
| `safes:read` | View Safe details, balances, and transactions |
| `safes:create` | Add new Safes to the inventory |
| `safes:delete` | Remove Safes from the inventory |
| `teams:read` | View teams and their members |
| `teams:create` | Create new teams |
| `members:read` | View organization members |
| `members:update` | Assign roles to members |
| `invites:read` | View invite links |
| `invites:create` | Create new invite links |
| `export:inventory` | Export Safe data to CSV |
| `billing:manage` | Manage subscription and billing |

**Team-Level Roles:**

| Role | Access |
|------|--------|
| **Team Lead** | Manage their team: add/remove Safes, invite members, manage team membership |
| **Team Member** | View Safes within their team only |

### Teams

Teams are the core organizational unit:

- Each Safe belongs to exactly one team
- Members belong to one or more teams
- Team leads manage their own members and Safes
- Org admins can manage all teams
- The "Default Team" contains all Safes unless reassigned

### Inviting Members

1. Go to **Settings → Invites**
2. Generate an invite link with optional settings:
   - **Expiry:** Link expires after X hours/days
   - **Usage limit:** Link can only be used N times
   - **Pre-assigned role:** Member gets this role on join
3. Share the link with new members
4. They create an account and are automatically added to your org

### Member Management

In **Settings → Members**, you can:
- View all members with their roles, teams, and join dates
- Assign members to teams (add/remove)
- Change member roles (admin/member with custom role)
- Remove members from the organization
- See which teams each member belongs to

### Security Features

- **Last owner protection:** You cannot remove or demote the last owner of an organization
- **Admin claim:** If an organization loses all admins, eligible members (with matching email domain) can claim the admin role through email verification
- **Domain-gated org creation:** Organizations can be configured with email domain restrictions
- **Session management:** Members can view and revoke their active sessions

## Key Capabilities

- **Team-based access control:** Scope Safes and permissions to specific teams
- **Custom roles:** 18 granular permissions combinable into named roles
- **Secure invites:** Expiring, usage-limited invite links
- **Team lead delegation:** Team leads manage their own members without org admin involvement
- **Complete audit trail:** Every member action, invite, and role change is logged
- **Last-owner protection:** Prevents accidental loss of org control
- **Admin claim flow:** Recovery mechanism for orgs that lose their admins

## Expected Outcomes

After setting up your organization:
1. Each team sees only their relevant Safes — no information overload
2. New members are productive within minutes via invite links and pre-assigned roles
3. Team leads handle day-to-day member management without admin involvement
4. You have a complete audit trail for compliance and security reviews
5. Offboarding is structured — remove a member once and they lose access to everything
