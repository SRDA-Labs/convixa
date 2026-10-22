import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import {
  getChecklistTemplatesByOrg,
  createChecklistTemplate,
} from "@/lib/db/repositories/operational-workflows.repository";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  classification: z.string().nullable().optional(),
  txCategories: z.array(z.string()).optional(),
  itemsJson: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(["auto", "manual"]),
      autoRule: z.string().optional(),
      required: z.boolean().optional(),
    })
  ),
});

export async function GET() {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:read", auth.orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await getChecklistTemplatesByOrg(auth.orgId);
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasPermission("security:manage", auth.orgId))) {
    return NextResponse.json({ error: "Security manage permission required" }, { status: 403 });
  }

  const body = await parseRequestBody(req, createSchema);
  if ("error" in body) return body.error;

  const template = await createChecklistTemplate({
    orgId: auth.orgId,
    ...body.data,
  });

  return NextResponse.json({ template }, { status: 201 });
}
