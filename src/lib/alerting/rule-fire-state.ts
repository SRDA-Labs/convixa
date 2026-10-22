/**
 * Rule fire state: detect first-fire transition (NOT FIRING → FIRING) for email fanout.
 * Uses rule_fire_state table. Call within evaluation flow; send email only when firstFire is true.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { ruleFireState } from "@/lib/db/schema";

/**
 * Update rule_fire_state for (ruleId, safeId) to isFiring.
 * Returns true if this is the first fire (transition from not firing to firing).
 * Uses a transaction to avoid race conditions.
 */
export async function updateRuleFireStateAndDetectFirstFire(
  ruleId: string,
  safeId: string,
  isFiring: boolean
): Promise<{ firstFire: boolean }> {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(ruleFireState)
      .where(and(eq(ruleFireState.ruleId, ruleId), eq(ruleFireState.safeId, safeId)))
      .limit(1);

    const wasFiring = existing?.isFiring ?? false;
    const firstFire = !wasFiring && isFiring;
    const now = new Date();

    if (existing) {
      await tx
        .update(ruleFireState)
        .set({
          isFiring,
          lastFiredAt: firstFire ? now : existing.lastFiredAt,
          updatedAt: now,
        })
        .where(eq(ruleFireState.id, existing.id));
    } else {
      await tx.insert(ruleFireState).values({
        ruleId,
        safeId,
        isFiring,
        lastFiredAt: isFiring ? now : null,
        updatedAt: now,
      });
    }

    return { firstFire };
  });
}
