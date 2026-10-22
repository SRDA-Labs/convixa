/**
 * Transaction Helpers
 * 
 * Provides utilities for working with database transactions.
 */

import { db } from "../index";
import type { TransactionCallback } from "../types";

/**
 * Execute a function within a transaction
 * 
 * @example
 * ```ts
 * const result = await withTransaction(async (tx) => {
 *   const user = await tx.insert(users).values({...}).returning();
 *   const org = await tx.insert(orgs).values({...}).returning();
 *   return { user, org };
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: TransactionCallback<T>
): Promise<T> {
  return await db.transaction(callback);
}

/**
 * Execute multiple operations in a transaction with automatic rollback on error
 * 
 * @example
 * ```ts
 * const results = await transactional(
 *   (tx) => createUser(tx, userData),
 *   (tx) => createOrg(tx, orgData),
 *   (tx) => linkUserToOrg(tx, userId, orgId)
 * );
 * ```
 */
export async function transactional<T extends any[]>(
  ...operations: Array<(tx: any) => Promise<any>>
): Promise<T> {
  return await db.transaction(async (tx) => {
    const results: any[] = [];
    for (const operation of operations) {
      const result = await operation(tx);
      results.push(result);
    }
    return results as T;
  });
}
