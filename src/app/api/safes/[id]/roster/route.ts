import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { getRosterBySafeId } from "@/lib/db/repositories/safe-signer-roster.repository";
import { suggestOrgMemberMatches } from "@/lib/signer-roster/identity-matcher";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }

  const access = await validateSafeAccess(parsedId.data);
  if (access instanceof NextResponse) return access;
  const { safe } = access;

  const roster = await getRosterBySafeId(parsedId.data);
  const suggestions = await suggestOrgMemberMatches(
    safe.orgId,
    roster.map((r) => r.signerAddress)
  );

  return NextResponse.json({
    roster: roster.map((r) => ({
      id: r.id,
      signerAddress: r.signerAddress,
      displayName: r.displayName,
      signerType: r.signerType,
      roleLabel: r.roleLabel,
      orgMemberUserId: r.orgMemberUserId,
      hardwareWallet: r.hardwareWallet,
      isDedicatedSigner: r.isDedicatedSigner,
      verificationStatus: r.verificationStatus,
      verificationMethod: r.verificationMethod,
      verifiedAt: r.verifiedAt?.toISOString() ?? null,
      notes: r.notes,
      source: r.source,
      removedAt: r.removedAt?.toISOString() ?? null,
    })),
    suggestions,
  });
}

const createSchema = z.object({
  signerAddress: z.string().min(1),
  displayName: z.string().max(200).optional(),
  signerType: z
    .enum(["internal", "external_advisor", "security_partner", "unknown"])
    .optional(),
  roleLabel: z.string().max(200).optional(),
  orgMemberUserId: z.string().uuid().nullable().optional(),
  hardwareWallet: z.enum(["ledger", "trezor", "gridplus", "software", "unknown"]).optional(),
  isDedicatedSigner: z.boolean().nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }

  const access = await validateSafeAccess(parsedId.data);
  if (access instanceof NextResponse) return access;
  const { safe } = access;

  const { canManageTeam } = await import("@/lib/auth-server");
  if (!(await canManageTeam(safe.teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { createManualRosterEntry } = await import(
    "@/lib/db/repositories/safe-signer-roster.repository"
  );
  const { createAuditLog } = await import("@/lib/db/repositories/audit.repository");

  const row = await createManualRosterEntry({
    orgId: safe.orgId,
    safeId: safe.id,
    ...parsed.data,
  });

  if (!row) {
    return NextResponse.json({ error: "Failed to create roster entry" }, { status: 500 });
  }

  await createAuditLog({
    orgId: safe.orgId,
    userId: auth.userId,
    action: "signer.roster.create",
    resourceType: "safe_signer_roster",
    resourceId: row.id,
    metadata: { safeId: safe.id },
  });

  return NextResponse.json({ roster: row }, { status: 201 });
}
