import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { orgMembers, users, roles, teamMembers, teams } from "@/lib/db/schema";
import { isOrgAdmin, getOrgStatus, getTeamsUserLeads, hasPermission } from "@/lib/auth-server";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireOrg, requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";

const createMemberSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  teamId: z.string().uuid(),
  role: z.enum(["lead", "member"]),
});

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const orgResult = await requireOrg();
  if (orgResult instanceof NextResponse) return orgResult;
  const { orgId } = orgResult;
  const canRead = (await hasPermission("members:read", orgId)) || (await getTeamsUserLeads(orgId)).length > 0;
  if (!canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const list = await db
    .select({
      id: orgMembers.id,
      userId: orgMembers.userId,
      role: orgMembers.role,
      roleId: orgMembers.roleId,
      email: users.email,
      name: users.name,
      roleName: roles.name,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .leftJoin(roles, eq(orgMembers.roleId, roles.id))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(orgMembers.createdAt);

  const members = list.map((m) => ({
    id: m.id,
    userId: m.userId,
    email: m.email,
    name: m.name,
    role: m.role,
    roleId: m.roleId ?? null,
    roleName: m.roleName ?? null,
  }));

  return NextResponse.json({ members });
}

export async function POST(req: Request) {
  const result = await requireAuthOrgPermission("members:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  if (!(await isOrgAdmin(orgId))) {
    return NextResponse.json({ error: "Only org admins can add members." }, { status: 403 });
  }

  const parseResult = await parseRequestBody(req, createMemberSchema);
  if ("error" in parseResult) return parseResult.error;
  const parsed = parseResult.data;
  const { email, password, name, teamId, role } = parsed;
  const emailNorm = email.trim().toLowerCase();

  const [teamRow] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)))
    .limit(1);
  if (!teamRow) {
    return NextResponse.json({ error: "Team not found in your organization." }, { status: 404 });
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, emailNorm)).limit(1);
  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const passwordHash = await hash(password, 10);
    const [newUser] = await db.insert(users).values({
      email: emailNorm,
      name: name ?? null,
      passwordHash,
    }).returning();
    userId = newUser.id;
  }

  const [existingOrgMember] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);

  if (!existingOrgMember) {
    await db.insert(orgMembers).values({
      orgId,
      userId,
      role: "member",
    });
  }

  const [existingTeamMember] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (!existingTeamMember) {
    await db.insert(teamMembers).values({
      teamId,
      userId,
      role,
    });
  }

  return NextResponse.json({
    ok: true,
    userId,
    message: existingUser ? "Member added to org/team." : "Account created and member added.",
  });
}
