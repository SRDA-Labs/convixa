import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getDefaultOrgId, getDefaultTeams } from "@/lib/auth-server";
import { getAuditLogsByOrg } from "@/lib/db/repositories";
import { getSafeById, getSafesByTeams, getUserById, getTeamById } from "@/lib/db/repositories";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const NOTIFICATION_ACTIONS = [
  "safe.create",
  "member.add",
  "invite.accepted",
  "signer.verification.request",
  "signer.verification.complete",
  "incident.reported",
] as const;
const MAX_AUDIT = 40;
const MAX_PENDING_APPROVALS = 10;
const MAX_NOTIFICATIONS = 30;
const UNREAD_HOURS = 24;

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  relativeTime: string;
  link: string;
  createdAt: string;
};

function relativeTime(createdAt: Date): string {
  const now = new Date();
  const ms = now.getTime() - new Date(createdAt).getTime();
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (day > 0) return `${day} day${day === 1 ? "" : "s"} ago`;
  if (hour > 0) return `${hour} hour${hour === 1 ? "" : "s"} ago`;
  if (min > 0) return `${min} minute${min === 1 ? "" : "s"} ago`;
  return "Just now";
}

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const orgId = await getDefaultOrgId();
  if (!orgId) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const [userTeams, auditList, linkedWalletRow] = await Promise.all([
    getDefaultTeams(),
    getAuditLogsByOrg(orgId, { limit: MAX_AUDIT }),
    db.select({ linkedWalletAddress: users.linkedWalletAddress }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  const linkedWallet = linkedWalletRow[0]?.linkedWalletAddress?.trim() ?? null;

  const teamIds = userTeams.map((t) => t.teamId);
  const items: NotificationItem[] = [];

  const auditFiltered = auditList.filter((log) =>
    NOTIFICATION_ACTIONS.includes(log.action as (typeof NOTIFICATION_ACTIONS)[number])
  );

  for (const log of auditFiltered) {
    const createdAt = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
    const meta = (log.metadata as Record<string, unknown>) ?? {};
    let title = "";
    let description = "";
    let type = "";
    let link = "/dashboard";

    if (log.action === "safe.create") {
      type = "new_safe";
      title = "New Safe added";
      const safe = log.resourceId ? await getSafeById(log.resourceId) : null;
      const addr = (meta.address as string) ?? safe?.address ?? "";
      const shortAddr = addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
      const name = safe?.name ?? "";
      const display = name ? `${name} (${shortAddr})` : shortAddr || "Safe";
      description = `${display} was successfully registered.`;
      link = log.resourceId ? `/dashboard/safes/${log.resourceId}` : "/dashboard/safes";
    } else if (log.action === "member.add") {
      type = "new_member";
      title = "New Team Member";
      const teamName = (meta.teamName as string) ?? "";
      const addedUserId = meta.addedUserId as string | undefined;
      const actorUserId = log.userId;
      const [addedUser, actorUser] = await Promise.all([
        addedUserId ? getUserById(addedUserId) : null,
        actorUserId ? getUserById(actorUserId) : null,
      ]);
      const addedName = addedUser?.name ?? addedUser?.email ?? "Someone";
      const actorName = actorUser?.name ?? actorUser?.email ?? "Admin";
      description = `${addedName} was added to ${teamName} by ${actorName}.`;
      link = "/dashboard/teams?tab=members";
    } else if (log.action === "invite.accepted") {
      type = "invite_accepted";
      title = "Invite accepted";
      const teamId = meta.teamId as string | undefined;
      const email = (meta.email as string) ?? "Someone";
      const team = teamId ? await getTeamById(teamId) : null;
      const teamName = team?.name ?? "the team";
      description = `${email} accepted invite to ${teamName}.`;
      link = "/dashboard/teams?tab=invites";
    } else if (log.action === "signer.verification.request") {
      type = "signer_verification_requested";
      title = "Signer verification requested";
      description = "A team lead requested signer affiliation verification.";
      link = meta.safeId ? `/dashboard/safes/${meta.safeId}` : "/dashboard/security/verification";
    } else if (log.action === "signer.verification.complete") {
      type = "signer_verification_completed";
      title = "Signer verification completed";
      const addr = (meta.signerAddress as string) ?? "";
      const short = addr ? `${addr.slice(0, 8)}…` : "A signer";
      description = `${short} completed affiliation verification.`;
      link = meta.safeId ? `/dashboard/safes/${meta.safeId}` : "/dashboard/security/verification";
    } else if (log.action === "incident.reported") {
      type = "security_incident";
      title = "Security incident reported";
      const severity = (meta.severity as string) ?? "unknown";
      description = `New ${severity} severity incident — review and triage.`;
      link = log.resourceId
        ? `/dashboard/security/incidents/${log.resourceId}`
        : "/dashboard/security/incidents";
    }

    items.push({
      id: `audit-${log.id}`,
      type,
      title,
      description,
      relativeTime: relativeTime(createdAt),
      link,
      createdAt: createdAt.toISOString(),
    });
  }

  if (linkedWallet && teamIds.length > 0) {
    const safesList = await getSafesByTeams(teamIds);
    const bySafe = new Map<string, (typeof safesList)[0]>();
    const sorted = [...safesList].sort((a, b) => {
      const aT = a.refreshedAt ? new Date(a.refreshedAt).getTime() : 0;
      const bT = b.refreshedAt ? new Date(b.refreshedAt).getTime() : 0;
      return bT - aT;
    });
    for (const row of sorted) {
      if (!bySafe.has(row.id)) bySafe.set(row.id, row);
    }
    const linkedLower = linkedWallet.toLowerCase();
    let pendingCount = 0;
    for (const row of bySafe.values()) {
      if (pendingCount >= MAX_PENDING_APPROVALS) break;
      const pending = row.pendingCount ?? 0;
      if (pending <= 0) continue;
      const owners = Array.isArray(row.owners) ? row.owners : [];
      const isSigner = owners.some((o: string) => String(o).toLowerCase() === linkedLower);
      if (!isSigner) continue;
      const safeName = row.name ?? row.address ?? "Safe";
      pendingCount++;
      items.push({
        id: `pending-${row.id}`,
        type: "pending_approval",
        title: "Pending Approval",
        description: `Transaction requires your signature on ${safeName}.`,
        relativeTime: "Just now",
        link: `/dashboard/safes/${row.id}`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const top = items.slice(0, MAX_NOTIFICATIONS);
  const cutoff = new Date(Date.now() - UNREAD_HOURS * 60 * 60 * 1000);
  const unreadCount = top.filter((n) => new Date(n.createdAt) >= cutoff).length;

  return NextResponse.json({ notifications: top, unreadCount });
}
