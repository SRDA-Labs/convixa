import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { orgMembers, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  addIncidentParticipant,
  logIncidentActivity,
  getIncidentParticipants,
} from "@/lib/db/repositories/operational-workflows.repository";
import { resolveIncidentAccess } from "@/lib/incidents/service";
import { canInviteToIncident } from "@/lib/incidents/access";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const resolved = await resolveIncidentAccess(id, auth.userId, auth.orgId);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canInviteToIncident(resolved.access)) {
    return NextResponse.json({ error: "Only the reporter or an org admin can invite collaborators" }, { status: 403 });
  }

  const body = await parseRequestBody(req, bodySchema);
  if ("error" in body) return body.error;

  const [member] = await db
    .select({ userId: orgMembers.userId })
    .from(orgMembers)
    .where(
      and(eq(orgMembers.orgId, auth.orgId), eq(orgMembers.userId, body.data.userId))
    )
    .limit(1);

  if (!member) {
    return NextResponse.json({ error: "User is not a member of this organization" }, { status: 400 });
  }

  const existing = await getIncidentParticipants(id);
  if (existing.some((p) => p.userId === body.data.userId)) {
    return NextResponse.json({ error: "User is already on this incident" }, { status: 409 });
  }

  const participant = await addIncidentParticipant({
    incidentId: id,
    userId: body.data.userId,
    role: "collaborator",
    invitedByUserId: auth.userId,
  });

  if (!participant) {
    return NextResponse.json({ error: "Could not add participant" }, { status: 500 });
  }

  const [invitedUser] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, body.data.userId))
    .limit(1);

  const label = invitedUser?.name ?? invitedUser?.email ?? "A team member";

  await logIncidentActivity({
    incidentId: id,
    userId: auth.userId,
    action: "participant_invited",
    summary: `Invited ${label} to the incident`,
    metadata: { invitedUserId: body.data.userId },
  });

  return NextResponse.json({ participant }, { status: 201 });
}
