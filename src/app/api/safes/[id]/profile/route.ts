import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth, parseRequestBody, validateSafeAccess } from "@/lib/api-helpers";
import { canManageTeam } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { safes } from "@/lib/db/schema";
import { uuidSchema } from "@/lib/validations";

const profileSchema = z.object({
  classification: z
    .enum(["personal", "operational", "treasury", "protocol_critical"])
    .nullable()
    .optional(),
  purpose: z.string().max(2000).nullable().optional(),
  moduleExceptionNote: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
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

  if (!(await canManageTeam(safe.teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseRequestBody(req, profileSchema);
  if ("error" in body) return body.error;
  const data = body.data;

  const classification = data.classification ?? safe.classification ?? null;
  const purpose = data.purpose !== undefined ? data.purpose : safe.purpose;

  if (
    (classification === "treasury" || classification === "protocol_critical") &&
    !purpose?.trim()
  ) {
    return NextResponse.json(
      { error: "Purpose is required for treasury and protocol-critical safes" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(safes)
    .set({
      classification: data.classification !== undefined ? data.classification : safe.classification,
      purpose: data.purpose !== undefined ? data.purpose : safe.purpose,
      moduleExceptionNote:
        data.moduleExceptionNote !== undefined
          ? data.moduleExceptionNote
          : safe.moduleExceptionNote,
      updatedAt: new Date(),
    })
    .where(eq(safes.id, parsedId.data))
    .returning();

  return NextResponse.json({
    safe: {
      id: updated.id,
      classification: updated.classification,
      purpose: updated.purpose,
      moduleExceptionNote: updated.moduleExceptionNote,
    },
  });
}
