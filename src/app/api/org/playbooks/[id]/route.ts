import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthAndOrg, parseRequestBody } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/auth-server";
import {
  getPlaybookById,
  publishPlaybookVersion,
} from "@/lib/db/repositories/readiness.repository";

const patchSchema = z.object({
  title: z.string().min(1).max(200),
  contentMd: z.string().min(1).max(50000),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAndOrg();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const playbook = await getPlaybookById(id);
  if (!playbook || playbook.orgId !== auth.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ playbook });
}

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
  const existing = await getPlaybookById(id);
  if (!existing || existing.orgId !== auth.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await parseRequestBody(req, patchSchema);
  if ("error" in body) return body.error;

  const playbook = await publishPlaybookVersion({
    orgId: auth.orgId,
    scenario: existing.scenario,
    title: body.data.title,
    contentMd: body.data.contentMd,
    createdByUserId: auth.userId,
  });

  return NextResponse.json({ playbook });
}
