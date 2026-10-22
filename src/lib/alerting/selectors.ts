/**
 * Function selectors for transaction classification (4-byte / 10-char hex).
 * Uses viem-style selectors (0x-prefixed, 10 chars).
 */

export const SELECTORS = {
  // Governance (Safe toAddress === safe address)
  addOwnerWithThreshold: "0x0d582f13",
  removeOwner: "0xf8dc5dd9",
  changeThreshold: "0x694e80c3",
  swapOwner: "0xe318b52b",
  setGuard: "0xe19a9dd9",
  setFallbackHandler: "0xf08a0323",
  enableModule: "0x610b5925",
  disableModule: "0xe009cfde",
  // ERC20
  transfer: "0xa9059cbb",
  approve: "0x095ea7b3",
  transferFrom: "0x23b872dd",
} as const;

export type GovernanceSelector = keyof Pick<
  typeof SELECTORS,
  | "addOwnerWithThreshold"
  | "removeOwner"
  | "changeThreshold"
  | "swapOwner"
  | "setGuard"
  | "setFallbackHandler"
  | "enableModule"
  | "disableModule"
>;

import type { EventType } from "./types";

export const SELECTOR_TO_EVENT: Record<string, EventType> = {
  [SELECTORS.addOwnerWithThreshold]: "SIGNER_ADD_PROPOSED",
  [SELECTORS.removeOwner]: "SIGNER_REMOVE_PROPOSED",
  [SELECTORS.changeThreshold]: "THRESHOLD_CHANGE_PROPOSED",
  [SELECTORS.swapOwner]: "SIGNER_SWAP_PROPOSED",
  [SELECTORS.setGuard]: "GUARD_SET_PROPOSED",
  [SELECTORS.setFallbackHandler]: "FALLBACK_HANDLER_SET_PROPOSED",
  [SELECTORS.enableModule]: "MODULE_CHANGE_PROPOSED",
  [SELECTORS.disableModule]: "MODULE_CHANGE_PROPOSED",
  [SELECTORS.transfer]: "ERC20_TRANSFER_PROPOSED",
  [SELECTORS.approve]: "ERC20_APPROVAL_PROPOSED",
  [SELECTORS.transferFrom]: "ERC20_TRANSFER_FROM_PROPOSED",
};

export function getSelector(data: string | null): string | null {
  if (!data || data === "0x" || data.length < 10) return null;
  return data.slice(0, 10).toLowerCase();
}
