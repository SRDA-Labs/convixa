/**
 * Common Query Utilities
 * 
 * Reusable query patterns used across repositories.
 */

import { sql } from "drizzle-orm";
import type { CountResult, ExistsResult } from "../types";

/**
 * Parse count result from SQL query
 */
export function parseCount(result: any): number {
  if (!result || !result[0]) return 0;
  const count = result[0].count;
  return typeof count === "number" ? count : parseInt(String(count), 10);
}

/**
 * Create a count expression for SQL queries
 */
export function countExpression() {
  return sql<number>`count(*)`.as("count");
}

/**
 * Check if a record exists
 */
export function exists(result: any[]): boolean {
  return result.length > 0;
}

/**
 * Get first result or null
 */
export function firstOrNull<T>(results: T[]): T | null {
  return results[0] ?? null;
}

/**
 * Convert pagination options to SQL LIMIT/OFFSET
 */
export function paginationToSql(options?: { limit?: number; offset?: number }) {
  return {
    limit: options?.limit ?? 100,
    offset: options?.offset ?? 0,
  };
}
