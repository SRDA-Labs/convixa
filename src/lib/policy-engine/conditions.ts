/**
 * Condition evaluation helpers for the policy engine.
 * Each function returns true if the condition passes (policy may fire); false otherwise.
 */

import { getAddress } from "viem";
import type { ConditionConfig } from "./config";
import type { PendingTxInput } from "./types";
import { getAddressListById, getAddressListEntries } from "@/lib/db/repositories/address-lists.repository";
import {
  getFirstCounterpartyInteraction,
  getPeriodSpend,
} from "@/lib/db/repositories/transaction-history.repository";
import { getNativePriceUsd } from "@/lib/rates/coin-gecko";
import { eq, gte, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { safeSnapshots, normalizedEvents, orgBlacklistedAddresses } from "@/lib/db/schema";

export type ConditionContext = {
  orgId: string;
  safeId: string;
  network: string;
  safeTags: string[];
  pendingTxs: PendingTxInput[];
  /** Multisig implementation type (e.g. "safe", "zodiac"). */
  implementation?: string;
  /** For per-tx evaluation, the current tx being checked. */
  tx?: PendingTxInput;
};

function parseBigInt(s: string): bigint {
  try {
    return BigInt(s);
  } catch {
    return BigInt(0);
  }
}

/** Check a single condition. Returns true if condition passes. */
export async function evaluateCondition(
  condition: ConditionConfig,
  ctx: ConditionContext
): Promise<boolean> {
  switch (condition.type) {
    case "amount_usd_greater_than": {
      const tx = ctx.tx;
      if (!tx || ctx.pendingTxs.length === 0) return false;
      const priceUsd = await getNativePriceUsd(ctx.network);
      if (priceUsd <= 0) return false;
      const valueWei = parseBigInt(tx.value);
      if (valueWei === BigInt(0)) return false;
      const valueUsd = (Number(valueWei) / 1e18) * priceUsd;
      return valueUsd > condition.value;
    }
    case "approval_amount_usd_greater_than": {
      const tx = ctx.tx;
      if (!tx || ctx.pendingTxs.length === 0) return false;
      const priceUsd = await getNativePriceUsd(ctx.network);
      if (priceUsd <= 0) return false;
      const valueWei = parseBigInt(tx.value);
      if (valueWei === BigInt(0)) return false;
      const valueUsd = (Number(valueWei) / 1e18) * priceUsd;
      return valueUsd > condition.value;
    }
    case "counterparty_in_list": {
      const tx = ctx.tx;
      if (!tx) return false;
      let toNorm: string;
      try {
        toNorm = getAddress(tx.to).toLowerCase();
      } catch {
        return false;
      }
      if (condition.listId === "__blacklist__") {
        const orgRows = await db.select({ address: orgBlacklistedAddresses.address }).from(orgBlacklistedAddresses).where(eq(orgBlacklistedAddresses.orgId, ctx.orgId));
        const set = new Set(orgRows.map((r) => r.address.toLowerCase()));
        const inList = set.has(toNorm);
        return condition.mode === "deny" ? inList : !inList;
      }
      const list = await getAddressListById(condition.listId);
      if (!list || list.orgId !== ctx.orgId) return false;
      const entries = await getAddressListEntries(condition.listId);
      const allowSet = new Set(entries.map((e) => getAddress(e.address).toLowerCase()));
      const inList = allowSet.has(toNorm);
      if (condition.mode === "allow") return inList;
      return !inList;
    }
    case "counterparty_not_in_list": {
      const tx = ctx.tx;
      if (!tx) return false;
      let toNorm: string;
      try {
        toNorm = getAddress(tx.to).toLowerCase();
      } catch {
        return false;
      }
      const list = await getAddressListById(condition.listId);
      if (!list || list.orgId !== ctx.orgId) return true; // no list → treat as "not in list" so policy can block
      const entries = await getAddressListEntries(condition.listId);
      const set = new Set(entries.map((e) => getAddress(e.address).toLowerCase()));
      return !set.has(toNorm);
    }
    case "safe_tag_in": {
      const hasAny = condition.tags.some((t) => ctx.safeTags.includes(t));
      return hasAny;
    }
    case "to_exchange": {
      const tx = ctx.tx;
      if (!tx) return false;
      let toNorm: string;
      try {
        toNorm = getAddress(tx.to).toLowerCase();
      } catch {
        return false;
      }
      const list = await getAddressListById(condition.listId);
      if (!list || list.orgId !== ctx.orgId) return false;
      const entries = await getAddressListEntries(condition.listId);
      const set = new Set(entries.map((e) => getAddress(e.address).toLowerCase()));
      return set.has(toNorm);
    }
    case "time_of_day": {
      const { start, end, timezone } = condition.window;
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", hour: "2-digit", minute: "2-digit", hour12: false });
      const current = formatter.format(now);
      const [sH, sM] = start.split(":").map(Number);
      const [eH, eM] = end.split(":").map(Number);
      const currentMins = parseInt(current.slice(0, 2), 10) * 60 + parseInt(current.slice(3), 10);
      const startMins = sH * 60 + sM;
      const endMins = eH * 60 + eM;
      if (startMins <= endMins) return currentMins >= startMins && currentMins <= endMins;
      return currentMins >= startMins || currentMins <= endMins;
    }
    case "balance_change_pct": {
      // Compare current balance against a snapshot from lookbackMinutes ago.
      // Fires if change exceeds threshold (negative = decrease, positive = increase).
      const threshold = condition.threshold ?? -50;
      const lookbackMinutes = condition.lookbackMinutes ?? 60;
      const cutoff = new Date(Date.now() - lookbackMinutes * 60 * 1000);

      const snapshots = await db
        .select({ balances: safeSnapshots.balances, refreshedAt: safeSnapshots.refreshedAt })
        .from(safeSnapshots)
        .where(and(
          eq(safeSnapshots.safeId, ctx.safeId),
          gte(safeSnapshots.refreshedAt, cutoff)
        ))
        .orderBy(safeSnapshots.refreshedAt)
        .limit(2);

      if (snapshots.length < 2) return false;

      const balanceSum = (balances: unknown): number => {
        if (!Array.isArray(balances)) return 0;
        return balances.reduce((sum: number, b: any) => {
          // Only count native asset for simplicity
          if (b.tokenAddress == null && b.balance) {
            try { return sum + Number(BigInt(b.balance)) / 1e18; } catch { return sum; }
          }
          return sum;
        }, 0);
      };

      const oldBalance = balanceSum(snapshots[0].balances);
      const newBalance = balanceSum(snapshots[snapshots.length - 1].balances);
      if (oldBalance === 0) return false;

      const pctChange = ((newBalance - oldBalance) / oldBalance) * 100;
      if (threshold < 0) return pctChange <= threshold;    // alert on drops
      return pctChange >= threshold;                        // alert on spikes
    }
    case "event_type_in": {
      const eventTypes = condition.eventTypes ?? [];
      if (eventTypes.length === 0) return false;
      const cutoff = new Date(Date.now() - 60 * 60 * 1000); // last 60 min

      const events = await db
        .select({ eventType: normalizedEvents.eventType })
        .from(normalizedEvents)
        .where(and(
          eq(normalizedEvents.safeId, ctx.safeId),
          inArray(normalizedEvents.eventType, eventTypes),
          gte(normalizedEvents.createdAt, cutoff)
        ))
        .limit(1);

      return events.length > 0;
    }
    case "new_counterparty": {
      const tx = ctx.tx;
      if (!tx) return false;
      let toNorm: string;
      try {
        toNorm = getAddress(tx.to).toLowerCase();
      } catch {
        return false;
      }
      const lookbackDays = condition.lookbackDays ?? 30;
      const firstSeen = await getFirstCounterpartyInteraction(ctx.safeId, toNorm, lookbackDays);
      return firstSeen === null; // true if never seen before in lookback period
    }
    case "per_period_spend_usd": {
      const tx = ctx.tx;
      if (!tx) return false;
      const period = condition.period ?? "month";
      const limit = condition.limit ?? 100_000;
      const priceUsd = await getNativePriceUsd(ctx.network);
      if (priceUsd <= 0) return false;
      const currentSpendWei = await getPeriodSpend(ctx.safeId, period);
      const currentSpendUsd = (Number(currentSpendWei) / 1e18) * priceUsd;
      const txValueWei = parseBigInt(tx.value);
      const txValueUsd = (Number(txValueWei) / 1e18) * priceUsd;
      return (currentSpendUsd + txValueUsd) > limit;
    }
    default:
      return false;
  }
}

/** Evaluate all conditions (AND). Returns true if all pass. */
export async function evaluateConditions(
  conditions: ConditionConfig[],
  ctx: ConditionContext
): Promise<boolean> {
  for (const c of conditions) {
    const pass = await evaluateCondition(c, ctx);
    if (!pass) return false;
  }
  return true;
}
