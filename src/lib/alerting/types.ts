/**
 * Types for proposal-time alerting (Level 1).
 */

/** Event types that can be subscribed to (for API validation and UI). */
export const SUBSCRIPTION_EVENT_TYPES = [
  "SIGNER_ADD_PROPOSED",
  "SIGNER_REMOVE_PROPOSED",
  "THRESHOLD_CHANGE_PROPOSED",
  "SIGNER_SWAP_PROPOSED",
  "GUARD_SET_PROPOSED",
  "FALLBACK_HANDLER_SET_PROPOSED",
  "MODULE_CHANGE_PROPOSED",
  "ERC20_TRANSFER_PROPOSED",
  "ERC20_APPROVAL_PROPOSED",
  "ERC20_TRANSFER_FROM_PROPOSED",
  "ETH_TRANSFER_PROPOSED",
  "CONTRACT_CALL_PROPOSED",
] as const;

export type EventType =
  | "SIGNER_ADD_PROPOSED"
  | "SIGNER_REMOVE_PROPOSED"
  | "THRESHOLD_CHANGE_PROPOSED"
  | "SIGNER_SWAP_PROPOSED"
  | "GUARD_SET_PROPOSED"
  | "FALLBACK_HANDLER_SET_PROPOSED"
  | "MODULE_CHANGE_PROPOSED"
  | "ERC20_TRANSFER_PROPOSED"
  | "ERC20_APPROVAL_PROPOSED"
  | "ERC20_TRANSFER_FROM_PROPOSED"
  | "ETH_TRANSFER_PROPOSED"
  | "CONTRACT_CALL_PROPOSED";

export type EventCategory = "governance" | "erc20" | "eth_transfer" | "contract_call";

export interface RawTransactionRow {
  id: string;
  safeId: string;
  safeTxHash: string;
  toAddress: string;
  value: string;
  data: string | null;
  operation: number;
  proposedBy: string;
  nonce: number;
  createdAt: Date;
}

export interface NormalizedEventRow {
  id: string;
  safeId: string;
  safeTxHash: string;
  eventType: EventType;
  category: EventCategory;
  metadata: NormalizedEventMetadata;
  createdAt: Date;
}

export interface NormalizedEventMetadata {
  tokenAddress?: string;
  amount?: string;
  spender?: string;
  methodSignature?: string;
  proposedBy: string;
  value: string;
  toAddress: string;
  decodedSummary?: string;
}

export interface ClassifiedEvent {
  eventType: EventType;
  category: EventCategory;
  metadata: NormalizedEventMetadata;
}
