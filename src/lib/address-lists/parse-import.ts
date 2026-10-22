import { getAddress } from "viem";

export type ParsedDirectoryEntry = {
  address: string;
  label: string;
  notes?: string;
};

export type ParsedWatchlistEntry = {
  address: string;
};

const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function normalizeAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!ETH_ADDRESS.test(trimmed)) return null;
  try {
    return getAddress(trimmed);
  } catch {
    return null;
  }
}

/** Parse `label,0x…` or `0x…,label` or bare `0x…` (label falls back to shortened address). */
export function parseDirectoryImportLine(line: string): ParsedDirectoryEntry | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const commaParts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const firstAddr = normalizeAddress(commaParts[0]);
    const secondAddr = normalizeAddress(commaParts[1]);
    if (firstAddr && !secondAddr) {
      return { address: firstAddr, label: commaParts.slice(1).join(", ").slice(0, 200) };
    }
    if (secondAddr && !firstAddr) {
      return { address: secondAddr, label: commaParts[0].slice(0, 200) };
    }
    if (firstAddr && secondAddr) {
      return { address: firstAddr, label: commaParts[1].slice(0, 200) };
    }
  }

  const addr = normalizeAddress(trimmed);
  if (!addr) return null;
  return {
    address: addr,
    label: `${addr.slice(0, 6)}…${addr.slice(-4)}`,
  };
}

export function parseWatchlistImport(text: string): ParsedWatchlistEntry[] {
  const out: ParsedWatchlistEntry[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[\n,;\s]+/)) {
    const addr = normalizeAddress(part);
    if (!addr || seen.has(addr.toLowerCase())) continue;
    seen.add(addr.toLowerCase());
    out.push({ address: addr });
  }
  return out;
}

export function parseDirectoryImport(text: string): ParsedDirectoryEntry[] {
  const out: ParsedDirectoryEntry[] = [];
  const seen = new Set<string>();
  for (const line of text.split("\n")) {
    const parsed = parseDirectoryImportLine(line);
    if (!parsed) continue;
    const key = parsed.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }
  return out;
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 40)
    .slice(0, 10);
}
