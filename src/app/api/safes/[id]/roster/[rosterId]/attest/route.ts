import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { isOrgAdmin } from "@/lib/auth-server";
import { uuidSchema } from "@/lib/validations";
import {
  getRosterById,
  updateRosterEntry,
} from "@/lib/db/repositories/safe-signer-roster.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";

const bodySchema = z.object({
  notes: z.string().min(20).max(2000),
});

export async function POST(
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

  if (!(await isOrgAdmin(safe.orgId))) {
    return NextResponse.json({ error: "Org admin required for attestation" }, { status: 403 });
  }

  const row = await getRosterById(rosterId);
  if (!row || row.safeId !== id || row.removedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Attestation notes required (min 20 characters)" },
      { status: 400 }
    );
  }

  const updated = await updateRosterEntry(rosterId, {
    verificationStatus: "verified",
    verificationMethod: "admin_attested",
    verifiedAt: new Date(),
    verifiedByUserId: auth.userId,
    notes: parsed.data.notes,
  });

  await createAuditLog({
    orgId: safe.orgId,
    userId: auth.userId,
    action: "signer.attestation",
    resourceType: "safe_signer_roster",
    resourceId: rosterId,
    metadata: { safeId: safe.id, notesLength: parsed.data.notes.length },
  });

  return NextResponse.json({ roster: updated });
}
