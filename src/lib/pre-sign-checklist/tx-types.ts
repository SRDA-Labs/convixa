/**
 * Canonical Safe transaction types for Convixa pre-sign checklists.
 *
 * Derived from Safe Transaction Service multisig fields:
 * - `operation` — 0 = CALL, 1 = DELEGATE_CALL
 * - `dataDecoded.method` — decoded contract method (see data decoder docs)
 * - `value` / `data` — native transfer vs contract interaction
 *
 * Transfer history types (ETHER_TRANSFER, ERC20_TRANSFER, ERC721_TRANSFER) are
 * documented on incoming/outgoing transfer endpoints; we infer the equivalent
 * category from multisig calldata when `dataDecoded` is present.
 *
 * @see https://docs.safe.global/core-api/transaction-service-overview
 * @see https://docs.safe.global/core-api/transaction-service-guides/data-decoder
 */

export const SAFE_TX_TYPES = [
  "NATIVE_TRANSFER",
  "ERC20_TRANSFER",
  "ERC721_TRANSFER",
  "TOKEN_APPROVAL",
  "CONTRACT_CALL",
  "DELEGATE_CALL",
  "BATCH_MULTISEND",
  "MODULE_EXECUTION",
  "ADD_OWNER",
  "REMOVE_OWNER",
  "REPLACE_OWNER",
  "CHANGE_THRESHOLD",
  "SET_GUARD",
  "SET_FALLBACK_HANDLER",
  "ENABLE_MODULE",
  "DISABLE_MODULE",
  "APPROVE_HASH",
  "SIGN_MESSAGE",
  "UNKNOWN",
] as const;

export type SafeTxType = (typeof SAFE_TX_TYPES)[number];

/** @deprecated Legacy checklist category — maps to {@link SafeTxType}. */
const LEGACY_CATEGORY_ALIASES: Record<string, SafeTxType> = {
  ETH_TRANSFER: "NATIVE_TRANSFER",
  GOVERNANCE: "CHANGE_THRESHOLD",
};

const SAFE_GOVERNANCE_METHODS: Record<string, SafeTxType> = {
  addownerwiththreshold: "ADD_OWNER",
  removeowner: "REMOVE_OWNER",
  swapowner: "REPLACE_OWNER",
  changethreshold: "CHANGE_THRESHOLD",
  setguard: "SET_GUARD",
  setfallbackhandler: "SET_FALLBACK_HANDLER",
  enablemodule: "ENABLE_MODULE",
  disablemodule: "DISABLE_MODULE",
  approvehash: "APPROVE_HASH",
  signmessage: "SIGN_MESSAGE",
  multisend: "BATCH_MULTISEND",
  exectransactionfrommodule: "MODULE_EXECUTION",
  exectransaction: "MODULE_EXECUTION",
};

const TOKEN_METHODS: Record<string, SafeTxType> = {
  transfer: "ERC20_TRANSFER",
  transferfrom: "ERC20_TRANSFER",
  safetransferfrom: "ERC721_TRANSFER",
  approve: "TOKEN_APPROVAL",
  setapprovalforall: "TOKEN_APPROVAL",
};

export const SAFE_TX_TYPE_LABELS: Record<SafeTxType, string> = {
  NATIVE_TRANSFER: "Native transfer",
  ERC20_TRANSFER: "ERC-20 transfer",
  ERC721_TRANSFER: "NFT transfer",
  TOKEN_APPROVAL: "Token approval",
  CONTRACT_CALL: "Contract call",
  DELEGATE_CALL: "Delegate call",
  BATCH_MULTISEND: "Batch transaction",
  MODULE_EXECUTION: "Module execution",
  ADD_OWNER: "Add owner",
  REMOVE_OWNER: "Remove owner",
  REPLACE_OWNER: "Replace owner",
  CHANGE_THRESHOLD: "Change threshold",
  SET_GUARD: "Set guard",
  SET_FALLBACK_HANDLER: "Set fallback handler",
  ENABLE_MODULE: "Enable module",
  DISABLE_MODULE: "Disable module",
  APPROVE_HASH: "Approve hash",
  SIGN_MESSAGE: "Sign message",
  UNKNOWN: "Unknown transaction",
};

export type ClassifySafeTransactionInput = {
  method?: string | null;
  value?: string | null;
  data?: string | null;
  /** Safe multisig operation: 0 = CALL, 1 = DELEGATE_CALL */
  operation?: number | string | null;
};

function normalizeMethod(method?: string | null): string {
  return (method ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasCalldata(data?: string | null): boolean {
  return Boolean(data && data !== "0x" && data.length > 2);
}

function parseOperation(operation?: number | string | null): number | null {
  if (operation === undefined || operation === null) return null;
  const n = typeof operation === "string" ? parseInt(operation, 10) : operation;
  return Number.isFinite(n) ? n : null;
}

/**
 * Classify a pending Safe multisig transaction into a canonical Convixa type.
 */
export function classifySafeTransaction(input: ClassifySafeTransactionInput): SafeTxType {
  const methodKey = normalizeMethod(input.method);
  const op = parseOperation(input.operation);

  if (op === 1) {
    return "DELEGATE_CALL";
  }

  if (methodKey && SAFE_GOVERNANCE_METHODS[methodKey]) {
    return SAFE_GOVERNANCE_METHODS[methodKey];
  }

  if (methodKey && TOKEN_METHODS[methodKey]) {
    if (methodKey === "transfer") {
      return hasCalldata(input.data) ? "ERC20_TRANSFER" : "NATIVE_TRANSFER";
    }
    return TOKEN_METHODS[methodKey];
  }

  if (methodKey === "fallback") {
    return hasCalldata(input.data) ? "CONTRACT_CALL" : "UNKNOWN";
  }

  if (methodKey) {
    return "CONTRACT_CALL";
  }

  try {
    const valueBn = BigInt(input.value ?? "0");
    const dataPresent = hasCalldata(input.data);
    if (valueBn > BigInt(0) && !dataPresent) return "NATIVE_TRANSFER";
    if (dataPresent) return "CONTRACT_CALL";
    if (valueBn === BigInt(0) && !dataPresent) return "UNKNOWN";
  } catch {
    // ignore
  }

  return hasCalldata(input.data) ? "CONTRACT_CALL" : "UNKNOWN";
}

/** Normalize stored / legacy category strings to {@link SafeTxType}. */
export function normalizeSafeTxType(raw: string, input?: ClassifySafeTransactionInput): SafeTxType {
  const trimmed = raw.trim();
  if (!trimmed) return "UNKNOWN";

  const upper = trimmed.toUpperCase().replace(/\s+/g, "_");
  if (LEGACY_CATEGORY_ALIASES[upper]) {
    return LEGACY_CATEGORY_ALIASES[upper];
  }
  if ((SAFE_TX_TYPES as readonly string[]).includes(upper)) {
    return upper as SafeTxType;
  }

  if (input) {
    return classifySafeTransaction(input);
  }

  const lower = trimmed.toLowerCase();
  if (lower === "transfer" || lower === "native transfer") return "NATIVE_TRANSFER";
  if (lower.includes("nft") || lower.includes("erc-721") || lower.includes("erc721")) {
    return "ERC721_TRANSFER";
  }
  if (lower.includes("erc-20") || lower.includes("erc20") || lower === "transferfrom") {
    return "ERC20_TRANSFER";
  }
  if (lower.includes("approval") || lower === "approve") return "TOKEN_APPROVAL";
  if (lower === "batch" || lower.includes("multisend")) return "BATCH_MULTISEND";
  if (lower === "module call" || lower.includes("module execution")) return "MODULE_EXECUTION";
  if (lower.includes("delegate")) return "DELEGATE_CALL";
  if (lower.includes("add owner")) return "ADD_OWNER";
  if (lower.includes("remove owner")) return "REMOVE_OWNER";
  if (lower.includes("replace owner")) return "REPLACE_OWNER";
  if (lower.includes("change threshold")) return "CHANGE_THRESHOLD";
  if (lower.includes("set guard")) return "SET_GUARD";
  if (lower.includes("fallback handler")) return "SET_FALLBACK_HANDLER";
  if (lower.includes("enable module")) return "ENABLE_MODULE";
  if (lower.includes("disable module")) return "DISABLE_MODULE";
  if (lower.includes("approve hash")) return "APPROVE_HASH";
  if (lower.includes("sign message")) return "SIGN_MESSAGE";
  if (lower === "contract call" || lower === "transfer + call") return "CONTRACT_CALL";

  return "UNKNOWN";
}

export function getSafeTxTypeLabel(type: SafeTxType): string {
  return SAFE_TX_TYPE_LABELS[type];
}
