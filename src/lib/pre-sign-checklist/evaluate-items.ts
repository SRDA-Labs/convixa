import { getAddress } from "viem";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgBlacklistedAddresses } from "@/lib/db/schema";
import { findAddressInOrgAddressLists } from "@/lib/db/repositories/address-lists.repository";
import { getFirstCounterpartyInteraction } from "@/lib/db/repositories/transaction-history.repository";
import { getNativePriceUsd } from "@/lib/rates/coin-gecko";
import { evaluateDestinationKnown } from "./destination-known";
import type { AutoSeverity, ChecklistItemDef, EvaluatedChecklistItem } from "./types";

const DEFAULT_AMOUNT_LIMIT_USD = 50_000;
const COUNTERPARTY_LOOKBACK_DAYS = 365;

export type TxContext = {
  orgId: string;
  safeId: string;
  network: string;
  to: string;
  value: string;
  txCategory: string;
};

type AutoRuleResult = {
  pass: boolean;
  message: string;
  applicable: boolean;
  severity?: AutoSeverity;
  action?: { href: string; label: string };
};

async function evalAutoRule(rule: string, ctx: TxContext): Promise<AutoRuleResult> {
  let toNorm: string;
  try {
    toNorm = getAddress(ctx.to).toLowerCase();
  } catch {
    return { pass: false, message: "Invalid destination address", applicable: true };
  }

  if (rule === "not_blacklisted") {
    const rows = await db
      .select({ address: orgBlacklistedAddresses.address })
      .from(orgBlacklistedAddresses)
      .where(eq(orgBlacklistedAddresses.orgId, ctx.orgId));
    const blocked = rows.some((r) => r.address.toLowerCase() === toNorm);
    return {
      pass: !blocked,
      message: blocked ? "Destination is blacklisted" : "Not on blacklist",
      applicable: true,
    };
  }

  if (rule === "destination_known") {
    const prior = await getFirstCounterpartyInteraction(
      ctx.safeId,
      toNorm,
      COUNTERPARTY_LOOKBACK_DAYS
    );
    const inList = await findAddressInOrgAddressLists(ctx.orgId, ctx.to);
    const result = evaluateDestinationKnown({
      hasTransactionHistory: prior != null,
      addressListMatch: inList,
      destinationAddress: ctx.to,
    });
    return {
      pass: result.pass,
      message: result.message,
      applicable: true,
      severity: result.severity,
      action: result.action,
    };
  }

  if (rule === "amount_within_policy") {
    try {
      const valueWei = BigInt(ctx.value || "0");
      if (valueWei === BigInt(0)) {
        return { pass: true, message: "No native value transfer", applicable: true };
      }
      const priceUsd = await getNativePriceUsd(ctx.network);
      if (priceUsd <= 0) {
        return { pass: true, message: "USD price unavailable — skip", applicable: false };
      }
      const usd = (Number(valueWei) / 1e18) * priceUsd;
      const pass = usd <= DEFAULT_AMOUNT_LIMIT_USD;
      return {
        pass,
        message: pass
          ? `~$${Math.round(usd).toLocaleString()} within limit`
          : `~$${Math.round(usd).toLocaleString()} exceeds $${DEFAULT_AMOUNT_LIMIT_USD.toLocaleString()}`,
        applicable: true,
      };
    } catch {
      return { pass: true, message: "Could not evaluate amount", applicable: false };
    }
  }

  if (rule === "new_counterparty") {
    const prior = await getFirstCounterpartyInteraction(
      ctx.safeId,
      toNorm,
      COUNTERPARTY_LOOKBACK_DAYS
    );
    const isNew = prior == null;
    return {
      pass: !isNew,
      message: isNew ? "New counterparty — manual acknowledgment required" : "Known counterparty",
      applicable: isNew,
    };
  }

  return { pass: true, message: "", applicable: false };
}

export async function evaluateChecklistItems(
  items: ChecklistItemDef[],
  ctx: TxContext
): Promise<EvaluatedChecklistItem[]> {
  const results: EvaluatedChecklistItem[] = [];

  for (const item of items) {
    if (item.type === "manual") {
      if (item.autoRule === "new_counterparty") {
        const auto = await evalAutoRule("new_counterparty", ctx);
        results.push({
          ...item,
          applicable: auto.applicable,
          autoResult: auto.pass,
          autoMessage: auto.message,
        });
      } else {
        results.push({ ...item, applicable: true });
      }
      continue;
    }

    if (item.type === "auto" && item.autoRule) {
      const auto = await evalAutoRule(item.autoRule, ctx);
      results.push({
        ...item,
        applicable: auto.applicable,
        autoResult: auto.pass,
        autoMessage: auto.message,
        autoSeverity: auto.severity,
        autoAction: auto.action,
      });
    } else {
      results.push({ ...item, applicable: true, autoResult: null });
    }
  }

  return results;
}

export function isReviewComplete(
  items: EvaluatedChecklistItem[],
  itemsState: Record<string, { completed: boolean }>
): boolean {
  for (const item of items) {
    if (item.applicable === false) continue;
    if (item.required === false) continue;

    if (item.type === "auto") {
      if (item.autoResult === false) return false;
    } else if (!itemsState[item.id]?.completed) {
      return false;
    }
  }
  return true;
}
