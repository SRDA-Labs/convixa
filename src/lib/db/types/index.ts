/**
 * Common database types and interfaces
 */

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface CountResult {
  count: number;
}

export interface ExistsResult {
  exists: boolean;
}

/**
 * Generic insert/update result
 */
export type DbResult<T> = T | null;

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (tx: any) => Promise<T>;
