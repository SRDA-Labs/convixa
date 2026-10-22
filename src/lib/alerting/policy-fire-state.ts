/**
 * Policy fire state: detect first-fire transition for policy-driven alert emails.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { policyFireState } from "@/lib/db/schema";

export async function updatePolicyFireStateAndDetectFirstFire(
  policyId: string,
  safeId: string,
  isFiring: boolean
): Promise<{ firstFire: boolean }> {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(policyFireState)
      .where(and(eq(policyFireState.policyId, policyId), eq(policyFireState.safeId, safeId)))
      .limit(1);

    const wasFiring = existing?.isFiring ?? false;
    const firstFire = !wasFiring && isFiring;
    const now = new Date();

    if (existing) {
      await tx
        .update(policyFireState)
        .set({
          isFiring,
          lastFiredAt: firstFire ? now : existing.lastFiredAt,
          updatedAt: now,
        })
        .where(eq(policyFireState.id, existing.id));
    } else {
      await tx.insert(policyFireState).values({
        policyId,
        safeId,
        isFiring,
        lastFiredAt: isFiring ? now : null,
        updatedAt: now,
      });
    }

    return { firstFire };
  });
}
