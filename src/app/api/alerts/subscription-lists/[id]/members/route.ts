import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrgPermission, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import {
  getSubscriptionListById,
  addSubscriptionListMember,
  getSubscriptionListMembersWithIds,
} from "@/lib/db/repositories/subscription-lists.repository";

const addMemberSchema = z.object({
  email: z.string().min(1).email("Invalid email format"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const list = await getSubscriptionListById(idParsed.data);
  if (!list || list.organizationId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parseResult = await parseRequestBody(req, addMemberSchema);
  if ("error" in parseResult) return parseResult.error;
  const email = parseResult.data.email.trim().toLowerCase();

  const member = await addSubscriptionListMember(idParsed.data, email);
  if (!member) return NextResponse.json({ error: "Invalid email or already in list" }, { status: 400 });

  return NextResponse.json({
    member: {
      id: member.id,
      subscriptionListId: member.subscriptionListId,
      email: member.email,
      createdAt: member.createdAt,
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthOrgPermission("safes:read");
  if (result instanceof NextResponse) return result;
  const { orgId } = result;

  const { id } = await params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });

  const list = await getSubscriptionListById(idParsed.data);
  if (!list || list.organizationId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await getSubscriptionListMembersWithIds(idParsed.data);
  return NextResponse.json({ members });
}
