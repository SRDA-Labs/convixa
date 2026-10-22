import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth, validateSafeAccess, parseRequestBody } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { safeSnapshots } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { buildChecklistResponse } from "@/lib/operational-workflows/checklist-service";
import { upsertPendingTxReview } from "@/lib/db/repositories/operational-workflows.repository";
import { getUserWalletAddresses, isSignerWallet } from "@/lib/operational-workflows/user-wallets";
import { evaluateChecklistItems, isReviewComplete } from "@/lib/pre-sign-checklist/evaluate-items";
import { normalizeTxCategoryForChecklist } from "@/lib/pre-sign-checklist/normalize-tx-category";
import { resolveTemplate } from "@/lib/pre-sign-checklist/resolve-template";
import { getChecklistTemplatesByOrg } from "@/lib/db/repositories/operational-workflows.repository";
import type { ChecklistItemDef } from "@/lib/pre-sign-checklist/types";
import { createAuditLog } from "@/lib/db/repositories/audit.repository";
import { logTxProposalChecklistActivity } from "@/lib/tx-proposals/activity-hooks";

const reviewPostSchema = z.object({
  to: z.string(),
  value: z.string().default("0"),
  txCategory: z.string(),
  itemsState: z.record(
    z.string(),
    z.object({
      completed: z.boolean(),
      note: z.string().optional(),
    })
  ),
  walletAddress: z.string().optional(),
});

const reviewPatchSchema = z.object({
  status: z.enum(["in_progress", "completed", "signed"]).optional(),
  signingNote: z.string().max(500).nullable().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; safeTxHash: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id, safeTxHash: rawHash } = await params;
  const safeTxHash = decodeURIComponent(rawHash);
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid safe id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;
  const { safe } = access;

  const url = new URL(req.url);
  const to = url.searchParams.get("to") ?? "";
  const value = url.searchParams.get("value") ?? "0";
  const txCategory = url.searchParams.get("txCategory") ?? "UNKNOWN";
  const method = url.searchParams.get("method");
  const data = url.searchParams.get("data");
  const operation = url.searchParams.get("operation");

  const response = await buildChecklistResponse({
    orgId: safe.orgId,
    safeId: safe.id,
    network: safe.network,
    classification: safe.classification ?? null,
    safeTxHash,
    to,
    value,
    txCategory,
    method,
    data,
    operation,
    userId: auth.userId,
  });

  return NextResponse.json(response);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; safeTxHash: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id, safeTxHash: rawHash } = await params;
  const safeTxHash = decodeURIComponent(rawHash);
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid safe id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;
  const { safe } = access;

  const body = await parseRequestBody(req, reviewPostSchema);
  if ("error" in body) return body.error;
  const data = body.data;

  const [snapshot] = await db
    .select({ owners: safeSnapshots.owners })
    .from(safeSnapshots)
    .where(eq(safeSnapshots.safeId, id))
    .orderBy(desc(safeSnapshots.refreshedAt))
    .limit(1);

  const owners: string[] = Array.isArray(snapshot?.owners) ? snapshot.owners : [];
  const wallets = await getUserWalletAddresses(auth.userId);
  if (!isSignerWallet(owners, wallets)) {
    return NextResponse.json(
      { error: "Linked wallet must be a signer on this Safe" },
      { status: 403 }
    );
  }

  const templates = await getChecklistTemplatesByOrg(safe.orgId);
  const txCategory = normalizeTxCategoryForChecklist(data.txCategory, {
    value: data.value ?? "0",
  });
  const resolved = resolveTemplate(
    templates.map((t) => ({
      id: t.id,
      name: t.name,
      classification: t.classification,
      txCategories: (t.txCategories as string[] | null) ?? [],
      itemsJson: (t.itemsJson as ChecklistItemDef[] | null) ?? [],
    })),
    { classification: safe.classification ?? null, txCategory }
  );

  const items = resolved
    ? await evaluateChecklistItems(resolved.items, {
        orgId: safe.orgId,
        safeId: safe.id,
        network: safe.network,
        to: data.to,
        value: data.value ?? "0",
        txCategory,
      })
    : [];

  const complete = isReviewComplete(items, data.itemsState);
  const wallet = data.walletAddress?.toLowerCase() ?? wallets[0] ?? null;

  const review = await upsertPendingTxReview({
    orgId: safe.orgId,
    safeId: safe.id,
    safeTxHash,
    userId: auth.userId,
    walletAddress: wallet,
    templateId: resolved?.templateId ?? null,
    itemsStateJson: data.itemsState,
    status: complete ? "completed" : "in_progress",
    completedAt: complete ? new Date() : null,
  });

  if (complete) {
    await createAuditLog({
      orgId: safe.orgId,
      userId: auth.userId,
      action: "checklist.review.completed",
      resourceType: "safe",
      resourceId: safe.id,
      metadata: { safeTxHash },
    });
    await logTxProposalChecklistActivity(safe.id, safeTxHash, auth.userId, "checklist_completed");
  }

  return NextResponse.json({
    review,
    isComplete: complete,
    status: review?.status ?? (complete ? "completed" : "in_progress"),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; safeTxHash: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id, safeTxHash: rawHash } = await params;
  const safeTxHash = decodeURIComponent(rawHash);
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid safe id" }, { status: 400 });
  }

  const access = await validateSafeAccess(id);
  if (access instanceof NextResponse) return access;
  const { safe } = access;

  const body = await parseRequestBody(req, reviewPatchSchema);
  if ("error" in body) return body.error;
  const data = body.data;

  const review = await upsertPendingTxReview({
    orgId: safe.orgId,
    safeId: safe.id,
    safeTxHash,
    userId: auth.userId,
    status: data.status,
    signingNote: data.signingNote,
    completedAt: data.status === "signed" || data.status === "completed" ? new Date() : undefined,
  });

  if (data.status === "signed") {
    await createAuditLog({
      orgId: safe.orgId,
      userId: auth.userId,
      action: "checklist.review.signed",
      resourceType: "safe",
      resourceId: safe.id,
      metadata: { safeTxHash, signingNote: data.signingNote },
    });
    await logTxProposalChecklistActivity(safe.id, safeTxHash, auth.userId, "signed");
  }

  return NextResponse.json({ review });
}
