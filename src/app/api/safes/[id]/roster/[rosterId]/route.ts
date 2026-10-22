import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { canManageTeam } from "@/lib/auth-server";
import { uuidSchema } from "@/lib/validations";
import {
  getRosterById,
  updateRosterEntry,
  deleteManualRosterEntry,
} from "@/lib/db/repositories/safe-signer-roster.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";

const patchSchema = z.object({
  displayName: z.string().max(200).nullable().optional(),
  signerType: z
    .enum(["internal", "external_advisor", "security_partner", "unknown"])
    .optional(),
  roleLabel: z.string().max(200).nullable().optional(),
  orgMemberUserId: z.string().uuid().nullable().optional(),
  hardwareWallet: z
    .enum(["ledger", "trezor", "gridplus", "software", "unknown"])
    .nullable()
    .optional(),
  isDedicatedSigner: z.boolean().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

async function loadRosterForSafe(safeId: string, rosterId: string) {
  const row = await getRosterById(rosterId);
  if (!row || row.safeId !== safeId || row.removedAt) return null;
  return row;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; rosterId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id, rosterId } = await params;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(rosterId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;
  const { safe } = access;

  if (!(await canManageTeam(safe.teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await loadRosterForSafe(id, rosterId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updated = await updateRosterEntry(rosterId, parsed.data);
  await createAuditLog({
    orgId: safe.orgId,
    userId: auth.userId,
    action: "signer.roster.update",
    resourceType: "safe_signer_roster",
    resourceId: rosterId,
    metadata: { safeId: safe.id, changes: parsed.data },
  });

  return NextResponse.json({ roster: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; rosterId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id, rosterId } = await params;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(rosterId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;
  const { safe } = access;

  if (!(await canManageTeam(safe.teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await loadRosterForSafe(id, rosterId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await deleteManualRosterEntry(rosterId);
  if (!ok) {
    return NextResponse.json(
      { error: "Only manual roster entries can be deleted" },
      { status: 400 }
    );
  }

  await createAuditLog({
    orgId: safe.orgId,
    userId: auth.userId,
    action: "signer.roster.update",
    resourceType: "safe_signer_roster",
    resourceId: rosterId,
    metadata: { safeId: safe.id, deleted: true },
  });

  return NextResponse.json({ ok: true });
}
