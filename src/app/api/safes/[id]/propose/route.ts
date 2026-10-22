import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, validateSafeAccess } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { submitProposedTransaction } from "@/lib/safe-propose/owner-change";

const bodySchema = z.object({
  safeTxHash: z.string().min(1),
  senderAddress: z.string().min(1),
  senderSignature: z.string().min(1),
  safeTransactionData: z.object({
    to: z.string(),
    value: z.string(),
    data: z.string(),
    operation: z.union([z.literal(0), z.literal(1), z.number()]).optional(),
    safeTxGas: z.union([z.string(), z.number()]).optional(),
    baseGas: z.union([z.string(), z.number()]).optional(),
    gasPrice: z.union([z.string(), z.number()]).optional(),
    gasToken: z.string().optional(),
    refundReceiver: z.string().optional(),
    nonce: z.union([z.string(), z.number()]).optional(),
  }),
  origin: z.string().optional(),
});

/** POST /api/safes/[id]/propose — relay a wallet-signed Safe tx to Transaction Service. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }

  const safeResult = await validateSafeAccess(parsedId.data);
  if (safeResult instanceof NextResponse) return safeResult;
  const { safe } = safeResult;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid propose payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await submitProposedTransaction({
      network: safe.network,
      safeAddress: safe.address,
      safeTransactionData: parsed.data.safeTransactionData as Parameters<
        typeof submitProposedTransaction
      >[0]["safeTransactionData"],
      safeTxHash: parsed.data.safeTxHash,
      senderAddress: parsed.data.senderAddress,
      senderSignature: parsed.data.senderSignature,
      origin: parsed.data.origin,
    });
    return NextResponse.json({ ok: true, safeTxHash: parsed.data.safeTxHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Propose failed";
    console.error("[propose]", message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
