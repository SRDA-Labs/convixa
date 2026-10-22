/**
 * Users Repository
 * 
 * Handles all database operations for Users.
 */

import { eq } from "drizzle-orm";
import { db } from "../index";
import { users } from "../schema";
import { firstOrNull } from "../utils/queries";
import type { DbResult } from "../types";

/**
 * Create a new User
 */
export async function createUser(data: {
  email: string;
  name?: string | null;
  passwordHash?: string | null;
  twoFactorEnabled?: boolean;
}) {
  const [user] = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase().trim(),
      name: data.name ?? null,
      passwordHash: data.passwordHash ?? null,
      twoFactorEnabled: data.twoFactorEnabled ?? false,
    })
    .returning();

  return firstOrNull([user]);
}

/**
 * Get a User by ID
 */
export async function getUserById(userId: string): Promise<DbResult<typeof users.$inferSelect>> {
  const results = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return firstOrNull(results);
}

/**
 * Get a User by email
 */
export async function getUserByEmail(email: string): Promise<DbResult<typeof users.$inferSelect>> {
  const results = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return firstOrNull(results);
}

/**
 * Update a User
 */
export async function updateUser(
  userId: string,
  data: {
    name?: string | null;
    passwordHash?: string | null;
    emailVerified?: Date | null;
    image?: string | null;
    twoFactorEnabled?: boolean;
    timezone?: string | null;
    linkedWalletAddress?: string | null;
    preferences?: {
      theme?: "light" | "dark" | "system";
      currency?: string;
      dateFormat?: string;
      compactMode?: boolean;
    } | null;
  }
) {
  const [updated] = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return firstOrNull([updated]);
}

/**
 * Delete a User
 */
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    await db.delete(users).where(eq(users.id, userId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if user exists by email
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  const results = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  return results.length > 0;
}

/**
 * Enable 2FA for a user
 */
export async function enable2FA(userId: string) {
  return await updateUser(userId, { twoFactorEnabled: true });
}

/**
 * Disable 2FA for a user
 */
export async function disable2FA(userId: string) {
  return await updateUser(userId, { twoFactorEnabled: false });
}
