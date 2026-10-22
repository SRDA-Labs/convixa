export type SignerOverlapFlag =
  | "concentration"
  | "tag_conflict"
  | "sole_signer";

export interface SignerSafeRef {
  safeId: string;
  safeName: string | null;
  safeAddress: string;
  network: string;
  tags: string[];
  threshold: number | null;
  ownersCount: number;
}

export interface SignerOverlapEntry {
  signerAddress: string;
  safes: SignerSafeRef[];
  flags: SignerOverlapFlag[];
}

function parseTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === "string") {
    try {
      const p = JSON.parse(tags);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function analyzeSignerOverlap(
  rows: Array<{
    safeId: string;
    safeName: string | null;
    safeAddress: string;
    network: string;
    tags: unknown;
    threshold: number | null;
    owners: unknown;
  }>
): SignerOverlapEntry[] {
  const bySigner = new Map<string, SignerSafeRef[]>();

  for (const row of rows) {
    const owners = Array.isArray(row.owners) ? row.owners : [];
    const tags = parseTags(row.tags);
    const ref: SignerSafeRef = {
      safeId: row.safeId,
      safeName: row.safeName,
      safeAddress: row.safeAddress,
      network: row.network,
      tags,
      threshold: row.threshold,
      ownersCount: owners.length,
    };
    for (const o of owners) {
      const addr = String(o).toLowerCase();
      const list = bySigner.get(addr) ?? [];
      list.push(ref);
      bySigner.set(addr, list);
    }
  }

  const entries: SignerOverlapEntry[] = [];

  for (const [signerAddress, safes] of bySigner) {
    const flags: SignerOverlapFlag[] = [];

    if (safes.length >= 3) flags.push("concentration");

    const hasCold = safes.some((s) =>
      s.tags.some((t) => t.toLowerCase() === "cold")
    );
    const hasNonCold = safes.some((s) =>
      !s.tags.some((t) => t.toLowerCase() === "cold")
    );
    if (hasCold && hasNonCold) flags.push("tag_conflict");

    const soleSigner = safes.some(
      (s) => s.threshold === 1 && s.ownersCount === 1
    );
    if (soleSigner) flags.push("sole_signer");

    entries.push({ signerAddress, safes, flags });
  }

  return entries.sort((a, b) => b.safes.length - a.safes.length);
}
