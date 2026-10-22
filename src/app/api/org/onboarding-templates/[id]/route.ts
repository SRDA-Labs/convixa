import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import {
  getOnboardingTemplateById,
  updateOnboardingTemplate,
} from "@/lib/db/repositories/readiness.repository";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  itemsJson: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: z.enum(["auto", "manual"]),
        autoRule: z.string().optional(),
        required: z.boolean().optional(),
      })
    )
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:manage", auth.orgId))) {
    return NextResponse.json({ error: "Security manage permission required" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getOnboardingTemplateById(id);
  if (!existing || existing.orgId !== auth.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await parseRequestBody(req, patchSchema);
  if ("error" in body) return body.error;

  const template = await updateOnboardingTemplate(id, body.data);
  return NextResponse.json({ template });
}
