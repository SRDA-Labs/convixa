import { getAddress, isAddress, type Hex } from "viem";
import type { SafeTransactionData } from "@safe-global/types-kit";
import { SAFE_CHAINS, getSafeTxServiceBaseUrl } from "@/lib/safe-api";

export type OwnerChangeTemplate = "add" | "remove" | "rotate";

export type OwnerChangeOperation =
  | { type: "add"; ownerAddress: string; threshold: number }
  | { type: "remove"; ownerAddress: string; threshold: number }
  | { type: "rotate"; oldOwnerAddress: string; newOwnerAddress: string };

export type ProposeOwnerChangeResult = {
  safeTxHash: string;
  senderAddress: string;
  senderSignature: string;
  safeTransactionData: SafeTransactionData;
};

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

function chainIdForNetwork(network: string): number {
  const row = SAFE_CHAINS.find((c) => c.slug === network);
  if (!row) throw new Error(`Unsupported network: ${network}`);
  return row.chainId;
}

export function networkLabel(network: string): string {
  return SAFE_CHAINS.find((c) => c.slug === network)?.name ?? network;
}

export function normalizeAddress(addr: string): string {
  return getAddress(addr.trim());
}

export function isValidEthAddress(addr: string): boolean {
  try {
    return isAddress(addr.trim());
  } catch {
    return false;
  }
}

export function parseOwnersJson(owners: unknown): string[] {
  if (owners == null) return [];
  if (Array.isArray(owners)) {
    return owners.filter((o): o is string => typeof o === "string");
  }
  if (typeof owners === "string") {
    try {
      const parsed = JSON.parse(owners) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((o): o is string => typeof o === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function ownersInclude(owners: string[], address: string): boolean {
  const target = address.toLowerCase();
  return owners.some((o) => o.toLowerCase() === target);
}

/** Validate operation against current owners / proposed threshold. */
export function validateOwnerChangeForSafe(
  operation: OwnerChangeOperation,
  owners: string[],
  currentThreshold: number | null
): string | null {
  const count = owners.length;
  if (operation.type === "add") {
    if (ownersInclude(owners, operation.ownerAddress)) {
      return "Address is already an owner of this Safe";
    }
    const nextCount = count + 1;
    if (operation.threshold < 1 || operation.threshold > nextCount) {
      return `Threshold must be between 1 and ${nextCount}`;
    }
    return null;
  }
  if (operation.type === "remove") {
    if (!ownersInclude(owners, operation.ownerAddress)) {
      return "Address is not an owner of this Safe";
    }
    const nextCount = count - 1;
    if (nextCount < 1) return "Cannot remove the last owner";
    if (operation.threshold < 1 || operation.threshold > nextCount) {
      return `Threshold must be between 1 and ${nextCount}`;
    }
    return null;
  }
  // rotate
  if (!ownersInclude(owners, operation.oldOwnerAddress)) {
    return "Old address is not an owner of this Safe";
  }
  if (ownersInclude(owners, operation.newOwnerAddress)) {
    return "New address is already an owner of this Safe";
  }
  if (
    operation.oldOwnerAddress.toLowerCase() ===
    operation.newOwnerAddress.toLowerCase()
  ) {
    return "Old and new addresses must differ";
  }
  void currentThreshold;
  return null;
}

export function actionPreviewLabel(operation: OwnerChangeOperation): string {
  switch (operation.type) {
    case "add":
      return `addOwnerWithThreshold (${operation.threshold})`;
    case "remove":
      return `removeOwnerWithThreshold (${operation.threshold})`;
    case "rotate":
      return "swapOwner";
  }
}

/**
 * Build + sign an owner-change Safe tx with the connected wallet (browser only).
 * Does not submit to the Transaction Service — call the propose API relay next.
 */
export async function buildAndSignOwnerChange(params: {
  provider: Eip1193Provider;
  signerAddress: string;
  safeAddress: string;
  network: string;
  operation: OwnerChangeOperation;
}): Promise<ProposeOwnerChangeResult> {
  const Safe = (await import("@safe-global/protocol-kit")).default;

  const safeAddress = normalizeAddress(params.safeAddress);
  const signerAddress = normalizeAddress(params.signerAddress);

  const protocolKit = await Safe.init({
    provider: params.provider,
    signer: signerAddress,
    safeAddress,
  });

  const isOwner = await protocolKit.isOwner(signerAddress);
  if (!isOwner) {
    throw new Error("Connected wallet is not an owner of this Safe");
  }

  let safeTransaction;
  if (params.operation.type === "add") {
    safeTransaction = await protocolKit.createAddOwnerTx({
      ownerAddress: normalizeAddress(params.operation.ownerAddress),
      threshold: params.operation.threshold,
    });
  } else if (params.operation.type === "remove") {
    safeTransaction = await protocolKit.createRemoveOwnerTx({
      ownerAddress: normalizeAddress(params.operation.ownerAddress),
      threshold: params.operation.threshold,
    });
  } else {
    safeTransaction = await protocolKit.createSwapOwnerTx({
      oldOwnerAddress: normalizeAddress(params.operation.oldOwnerAddress),
      newOwnerAddress: normalizeAddress(params.operation.newOwnerAddress),
    });
  }

  const signed = await protocolKit.signTransaction(safeTransaction);
  const safeTxHash = await protocolKit.getTransactionHash(signed);
  const signature = signed.signatures.get(signerAddress.toLowerCase())?.data;
  if (!signature) {
    throw new Error("Missing signature from connected wallet");
  }

  return {
    safeTxHash,
    senderAddress: signerAddress,
    senderSignature: signature as Hex,
    safeTransactionData: signed.data,
  };
}

export function chainIdForSafeNetwork(network: string): number {
  return chainIdForNetwork(network);
}

/** Server-side: submit a signed propose payload to Safe Transaction Service. */
export async function submitProposedTransaction(params: {
  network: string;
  safeAddress: string;
  safeTransactionData: SafeTransactionData;
  safeTxHash: string;
  senderAddress: string;
  senderSignature: string;
  origin?: string;
}): Promise<void> {
  const SafeApiKit = (await import("@safe-global/api-kit")).default;
  const chainId = BigInt(chainIdForNetwork(params.network));
  const txServiceUrl = getSafeTxServiceBaseUrl(params.network).replace(/\/$/, "");
  const apiKey = process.env.SAFE_API_KEY?.trim();

  const apiKit = new SafeApiKit({
    chainId,
    txServiceUrl,
    ...(apiKey ? { apiKey } : {}),
  });

  await apiKit.proposeTransaction({
    safeAddress: normalizeAddress(params.safeAddress),
    safeTransactionData: params.safeTransactionData,
    safeTxHash: params.safeTxHash,
    senderAddress: normalizeAddress(params.senderAddress),
    senderSignature: params.senderSignature,
    origin: params.origin ?? "Convixa",
  });
}
