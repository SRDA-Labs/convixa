import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { canManageTeam } from "@/lib/auth-server";
import { uuidSchema } from "@/lib/validations";
import {
  getRosterById,
  createVerificationRequest,
} from "@/lib/db/repositories/safe-signer-roster.repository";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";
import {
  hashVerificationToken,
  issueAffiliationChallenge,
  getOrgName,
} from "@/lib/signer-roster/verify-affiliation";
import { sendSignerVerificationEmail } from "@/lib/email";

const bodySchema = z.object({
  email: z.string().email().optional(),
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
  const { safe, safeAddress } = access;

  if (!(await canManageTeam(safe.teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await getRosterById(rosterId);
  if (!row || row.safeId !== id || row.removedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  const orgName = await getOrgName(safe.orgId);
  const challenge = await issueAffiliationChallenge(row, {
    safeAddress,
    network: safe.network,
    orgName,
    safePurpose: safe.purpose ?? "",
  });

  await createAuditLog({
    orgId: safe.orgId,
    userId: auth.userId,
    action: "signer.verification.request",
    resourceType: "safe_signer_roster",
    resourceId: rosterId,
    metadata: { safeId: safe.id, requestId: challenge.requestId },
  });

  if (parsed.success && parsed.data.email) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashVerificationToken(token);
    const expiresAt = new Date(Date.now() + 7 * 86400000);

    await createVerificationRequest({
      rosterId,
      orgId: safe.orgId,
      email: parsed.data.email,
      tokenHash,
      expiresAt,
      createdByUserId: auth.userId,
    });

    const baseUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3001";
    const verifyUrl = `${baseUrl}/verify-signer/${token}`;

    await sendSignerVerificationEmail(parsed.data.email, {
      orgName,
      safeAddress,
      verifyUrl,
    });

    return NextResponse.json({
      ok: true,
      emailSent: true,
      expiresAt: challenge.expiresAt.toISOString(),
    });
  }

  return NextResponse.json({
    ok: true,
    message: "Verification requested — notify the signer to complete in-app verification.",
    expiresAt: challenge.expiresAt.toISOString(),
  });
}
