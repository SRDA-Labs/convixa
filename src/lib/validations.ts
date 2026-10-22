import { z } from "zod";

/**
 * Shared validation schemas used across API routes.
 */

/** UUID validation schema for resource IDs */
export const uuidSchema = z.string().uuid("Invalid resource id");

/** Safe address validation (Ethereum address) */
export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address format");

/** Chain ID validation */
export const chainIdSchema = z.number().positive("Invalid chain ID");

/** Pagination schemas */
export const paginationSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});
