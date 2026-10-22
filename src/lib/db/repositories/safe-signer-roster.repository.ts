/**
 * Safe Signer Roster Repository
 */

import { eq, and, isNull, desc, inArray, sql, lt } from "drizzle-orm";
import { getAddress } from "viem";
import { db } from "../index";
import {
  safeSignerRoster,
  signerAffiliationProofs,
  signerVerificationRequests,
  signerEoaActivity,
  safes,
} from "../schema";
import { firstOrNull } from "../utils/queries";

export type RosterRow = typeof safeSignerRoster.$inferSelect;

function checksumAddress(addr: string): string {
  try {
    return getAddress(addr);
  } catch {
    return addr.toLowerCase();
  }
}

export async function getRosterBySafeId(safeId: string, includeRemoved = false) {
  const conditions = [eq(safeSignerRoster.safeId, safeId)];
  if (!includeRemoved) {
    conditions.push(isNull(safeSignerRoster.removedAt));
  }
  return db
    .select()
    .from(safeSignerRoster)
    .where(and(...conditions))
    .orderBy(safeSignerRoster.signerAddress);
}

export async function getRosterById(rosterId: string) {
  const rows = await db
    .select()
    .from(safeSignerRoster)
    .where(eq(safeSignerRoster.id, rosterId))
    .limit(1);
  return firstOrNull(rows);
}

export async function getRosterBySafeAndAddress(safeId: string, signerAddress: string) {
  const addr = checksumAddress(signerAddress).toLowerCase();
  const rows = await db
    .select()
    .from(safeSignerRoster)
    .where(
      and(
        eq(safeSignerRoster.safeId, safeId),
        sql`lower(${safeSignerRoster.signerAddress}) = ${addr}`
      )
    )
    .limit(1);
  return firstOrNull(rows);
}

export async function upsertRosterFromSnapshot(params: {
  orgId: string;
  safeId: string;
  owners: string[];
}) {
  const now = new Date();
  const ownerSet = new Set(params.owners.map((o) => checksumAddress(o).toLowerCase()));

  const existing = await db
    .select()
    .from(safeSignerRoster)
    .where(eq(safeSignerRoster.safeId, params.safeId));

  for (const row of existing) {
    const addr = row.signerAddress.toLowerCase();
    if (!ownerSet.has(addr) && !row.removedAt) {
      await db
        .update(safeSignerRoster)
        .set({ removedAt: now, updatedAt: now })
        .where(eq(safeSignerRoster.id, row.id));
    } else if (ownerSet.has(addr) && row.removedAt) {
      await db
        .update(safeSignerRoster)
        .set({ removedAt: null, updatedAt: now })
        .where(eq(safeSignerRoster.id, row.id));
    }
  }

  for (const owner of params.owners) {
    const checksummed = checksumAddress(owner);
    const lower = checksummed.toLowerCase();
    const match = existing.find((r) => r.signerAddress.toLowerCase() === lower);

    if (!match) {
      await db.insert(safeSignerRoster).values({
        orgId: params.orgId,
        safeId: params.safeId,
        signerAddress: checksummed,
        verificationStatus: "unverified",
        source: "snapshot_sync",
      });
    }
  }
}

export async function createManualRosterEntry(data: {
  orgId: string;
  safeId: string;
  signerAddress: string;
  displayName?: string | null;
  signerType?: string;
  roleLabel?: string | null;
  orgMemberUserId?: string | null;
  hardwareWallet?: string | null;
  isDedicatedSigner?: boolean | null;
  notes?: string | null;
}) {
  const [row] = await db
    .insert(safeSignerRoster)
    .values({
      orgId: data.orgId,
      safeId: data.safeId,
      signerAddress: checksumAddress(data.signerAddress),
      displayName: data.displayName ?? null,
      signerType: data.signerType ?? "unknown",
      roleLabel: data.roleLabel ?? null,
      orgMemberUserId: data.orgMemberUserId ?? null,
      hardwareWallet: data.hardwareWallet ?? null,
      isDedicatedSigner: data.isDedicatedSigner ?? null,
      notes: data.notes ?? null,
      source: "manual",
      verificationStatus: "unverified",
    })
    .returning();
  return firstOrNull([row]);
}

export async function updateRosterEntry(
  rosterId: string,
  data: Partial<{
    displayName: string | null;
    signerType: string;
    roleLabel: string | null;
    orgMemberUserId: string | null;
    hardwareWallet: string | null;
    isDedicatedSigner: boolean | null;
    notes: string | null;
    verificationStatus: string;
    verificationMethod: string | null;
    verifiedAt: Date | null;
    verifiedByUserId: string | null;
    pendingAffiliationRequestId: string | null;
    pendingAffiliationExpiresAt: Date | null;
  }>
) {
  const [row] = await db
    .update(safeSignerRoster)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(safeSignerRoster.id, rosterId))
    .returning();
  return firstOrNull([row]);
}

export async function deleteManualRosterEntry(rosterId: string) {
  const row = await getRosterById(rosterId);
  if (!row || row.source !== "manual") return false;
  await db.delete(safeSignerRoster).where(eq(safeSignerRoster.id, rosterId));
  return true;
}

export async function createAffiliationProof(data: {
  rosterId: string;
  orgId: string;
  safeId: string;
  signerAddress: string;
  messageText: string;
  messageHash: string;
  signature: string;
  signedByUserId?: string | null;
  expiresAt?: Date | null;
}) {
  const [proof] = await db
    .insert(signerAffiliationProofs)
    .values({
      rosterId: data.rosterId,
      orgId: data.orgId,
      safeId: data.safeId,
      signerAddress: checksumAddress(data.signerAddress),
      messageText: data.messageText,
      messageHash: data.messageHash,
      signature: data.signature,
      signedByUserId: data.signedByUserId ?? null,
      expiresAt: data.expiresAt ?? null,
    })
    .returning();
  return firstOrNull([proof]);
}

export async function createVerificationRequest(data: {
  rosterId: string;
  orgId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  createdByUserId: string;
}) {
  const [req] = await db
    .insert(signerVerificationRequests)
    .values(data)
    .returning();
  return firstOrNull([req]);
}

export async function getVerificationRequestByTokenHash(tokenHash: string) {
  const rows = await db
    .select()
    .from(signerVerificationRequests)
    .where(eq(signerVerificationRequests.tokenHash, tokenHash))
    .limit(1);
  return firstOrNull(rows);
}

export async function updateVerificationRequest(
  id: string,
  data: { status: string }
) {
  const [row] = await db
    .update(signerVerificationRequests)
    .set(data)
    .where(eq(signerVerificationRequests.id, id))
    .returning();
  return firstOrNull([row]);
}

export async function getOrgRosterSummary(orgId: string) {
  const rows = await db
    .select({
      id: safeSignerRoster.id,
      safeId: safeSignerRoster.safeId,
      signerAddress: safeSignerRoster.signerAddress,
      verificationStatus: safeSignerRoster.verificationStatus,
      verificationMethod: safeSignerRoster.verificationMethod,
      signerType: safeSignerRoster.signerType,
      roleLabel: safeSignerRoster.roleLabel,
      displayName: safeSignerRoster.displayName,
      hardwareWallet: safeSignerRoster.hardwareWallet,
      removedAt: safeSignerRoster.removedAt,
      classification: safes.classification,
      safeName: safes.name,
      safeAddress: safes.address,
      network: safes.network,
    })
    .from(safeSignerRoster)
    .innerJoin(safes, eq(safeSignerRoster.safeId, safes.id))
    .where(and(eq(safeSignerRoster.orgId, orgId), isNull(safeSignerRoster.removedAt)));

  return rows;
}

export async function getOrgEoaActivity(orgId: string) {
  return db
    .select()
    .from(signerEoaActivity)
    .where(eq(signerEoaActivity.orgId, orgId))
    .orderBy(desc(signerEoaActivity.activityCount7d));
}

export async function upsertEoaActivity(data: {
  orgId: string;
  signerAddress: string;
  network: string;
  lastCheckedAt: Date;
  lastOutgoingTxAt: Date | null;
  lastOutgoingTxHash: string | null;
  activityCount7d: number;
  rawSummary: unknown;
}) {
  const [row] = await db
    .insert(signerEoaActivity)
    .values({
      orgId: data.orgId,
      signerAddress: data.signerAddress.toLowerCase(),
      network: data.network,
      lastCheckedAt: data.lastCheckedAt,
      lastOutgoingTxAt: data.lastOutgoingTxAt,
      lastOutgoingTxHash: data.lastOutgoingTxHash,
      activityCount7d: data.activityCount7d,
      rawSummary: data.rawSummary,
    })
    .onConflictDoUpdate({
      target: [signerEoaActivity.signerAddress, signerEoaActivity.network],
      set: {
        lastCheckedAt: data.lastCheckedAt,
        lastOutgoingTxAt: data.lastOutgoingTxAt,
        lastOutgoingTxHash: data.lastOutgoingTxHash,
        activityCount7d: data.activityCount7d,
        rawSummary: data.rawSummary,
        updatedAt: new Date(),
      },
    })
    .returning();
  return firstOrNull([row]);
}

export async function getDistinctRosterAddressesForOrg(orgId: string) {
  const rows = await db
    .selectDistinct({
      signerAddress: safeSignerRoster.signerAddress,
      network: safes.network,
    })
    .from(safeSignerRoster)
    .innerJoin(safes, eq(safeSignerRoster.safeId, safes.id))
    .where(and(eq(safeSignerRoster.orgId, orgId), isNull(safeSignerRoster.removedAt)));

  return rows;
}

export async function getRostersForExport(orgId: string) {
  return getOrgRosterSummary(orgId);
}

export async function expireStaleVerifications(orgId: string, proofTtlDays: number) {
  const cutoff = new Date(Date.now() - proofTtlDays * 86400000);
  await db
    .update(safeSignerRoster)
    .set({ verificationStatus: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(safeSignerRoster.orgId, orgId),
        eq(safeSignerRoster.verificationStatus, "verified"),
        lt(safeSignerRoster.verifiedAt, cutoff)
      )
    );
}

export async function getRosterBySafeIds(safeIds: string[]) {
  if (safeIds.length === 0) return [];
  return db
    .select()
    .from(safeSignerRoster)
    .where(and(inArray(safeSignerRoster.safeId, safeIds), isNull(safeSignerRoster.removedAt)));
}
