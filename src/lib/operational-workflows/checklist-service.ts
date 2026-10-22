import {
  getChecklistTemplatesByOrg,
  getReviewsBySafeTx,
  getReviewBySafeTxAndUser,
} from "@/lib/db/repositories/operational-workflows.repository";
import { normalizeTxCategoryForChecklist } from "@/lib/pre-sign-checklist/normalize-tx-category";
import { resolveTemplate } from "@/lib/pre-sign-checklist/resolve-template";
import { evaluateChecklistItems, isReviewComplete } from "@/lib/pre-sign-checklist/evaluate-items";
import type { ChecklistItemDef } from "@/lib/pre-sign-checklist/types";

export async function buildChecklistResponse(params: {
  orgId: string;
  safeId: string;
  network: string;
  classification: string | null;
  safeTxHash: string;
  to: string;
  value: string;
  txCategory: string;
  method?: string | null;
  data?: string | null;
  operation?: number | string | null;
  userId?: string;
}) {
  const templates = await getChecklistTemplatesByOrg(params.orgId);
  const txCategory = normalizeTxCategoryForChecklist(params.txCategory, {
    method: params.method,
    value: params.value,
    data: params.data,
    operation: params.operation,
  });
  const resolved = resolveTemplate(
    templates.map((t) => ({
      id: t.id,
      name: t.name,
      classification: t.classification,
      txCategories: (t.txCategories as string[] | null) ?? [],
      itemsJson: (t.itemsJson as ChecklistItemDef[] | null) ?? [],
    })),
    { classification: params.classification, txCategory }
  );

  if (!resolved) {
    return { template: null, items: [], reviews: [], myReview: null };
  }

  const items = await evaluateChecklistItems(resolved.items, {
    orgId: params.orgId,
    safeId: params.safeId,
    network: params.network,
    to: params.to,
    value: params.value,
    txCategory,
  });

  const reviews = await getReviewsBySafeTx(params.safeId, params.safeTxHash);
  const myReview = params.userId
    ? await getReviewBySafeTxAndUser(params.safeId, params.safeTxHash, params.userId)
    : null;

  const itemsState =
    (myReview?.itemsStateJson as Record<string, { completed: boolean }> | null) ?? {};

  return {
    template: { id: resolved.templateId, name: resolved.name },
    items,
    reviews: reviews.map((r) => ({
      id: r.id,
      userId: r.userId,
      status: r.status,
      signingNote: r.signingNote,
      completedAt: r.completedAt,
      updatedAt: r.updatedAt,
    })),
    myReview: myReview
      ? {
          id: myReview.id,
          status: myReview.status,
          signingNote: myReview.signingNote,
          itemsState: myReview.itemsStateJson,
          isComplete: isReviewComplete(items, itemsState),
        }
      : null,
  };
}
