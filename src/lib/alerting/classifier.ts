/**
 * Classify raw transaction into normalized event(s).
 * Uses viem for calldata decoding; matches selectors for governance / ERC20 / ETH / fallback.
 */

import { decodeFunctionData } from "viem";
import { getSelector, SELECTOR_TO_EVENT, SELECTORS } from "./selectors";
import type { ClassifiedEvent, EventType, NormalizedEventMetadata } from "./types";

const GOVERNANCE_SELECTORS: Set<string> = new Set([
  SELECTORS.addOwnerWithThreshold,
  SELECTORS.removeOwner,
  SELECTORS.changeThreshold,
  SELECTORS.swapOwner,
  SELECTORS.setGuard,
  SELECTORS.setFallbackHandler,
  SELECTORS.enableModule,
  SELECTORS.disableModule,
]);

const ERC20_SELECTORS: Set<string> = new Set([
  SELECTORS.transfer,
  SELECTORS.approve,
  SELECTORS.transferFrom,
]);

/** Minimal ABI for decoding ERC20 and Safe governance params. */
const ERC20_AND_GOV_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "addOwnerWithThreshold",
    inputs: [
      { name: "owner", type: "address" },
      { name: "threshold", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "removeOwner",
    inputs: [
      { name: "prevOwner", type: "address" },
      { name: "owner", type: "address" },
      { name: "threshold", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "swapOwner",
    inputs: [
      { name: "prevOwner", type: "address" },
      { name: "oldOwner", type: "address" },
      { name: "newOwner", type: "address" },
    ],
  },
  {
    type: "function",
    name: "changeThreshold",
    inputs: [{ name: "threshold", type: "uint256" }],
  },
] as const;

export interface ClassifierInput {
  safeId: string;
  safeAddress: string;
  safeTxHash: string;
  toAddress: string;
  value: string;
  data: string | null;
  operation: number;
  proposedBy: string;
  nonce: number;
}

/**
 * Classify a raw transaction into one or more normalized events.
 * Returns a single event per tx (primary classification).
 */
export function classifyTransaction(input: ClassifierInput): ClassifiedEvent {
  const { toAddress, value, data, safeAddress, proposedBy, safeTxHash } = input;
  const selector = getSelector(data);
  const baseMeta: NormalizedEventMetadata = {
    proposedBy,
    value,
    toAddress,
  };

  // 1) Governance: to === safe address
  if (toAddress.toLowerCase() === safeAddress.toLowerCase() && selector && GOVERNANCE_SELECTORS.has(selector)) {
    const eventType = SELECTOR_TO_EVENT[selector] as EventType | undefined;
    if (eventType) {
      let decodedSummary: string | undefined;
      try {
        const decoded = decodeFunctionData({
          abi: [...ERC20_AND_GOV_ABI],
          data: (data ?? "0x") as `0x${string}`,
        });
        decodedSummary = `${decoded.functionName}(${JSON.stringify(decoded.args)})`;
      } catch {
        decodedSummary = undefined;
      }
      return {
        eventType,
        category: "governance",
        metadata: { ...baseMeta, methodSignature: selector, decodedSummary },
      };
    }
  }

  // 2) ERC20
  if (selector && ERC20_SELECTORS.has(selector)) {
    const eventType = SELECTOR_TO_EVENT[selector] as EventType | undefined;
    if (eventType) {
      const metadata: NormalizedEventMetadata = { ...baseMeta, tokenAddress: toAddress };
      try {
        const decoded = decodeFunctionData({
          abi: [...ERC20_AND_GOV_ABI],
          data: (data ?? "0x") as `0x${string}`,
        });
        const args = decoded.args as unknown[] | undefined;
        if (decoded.functionName === "transfer" && args?.[0] != null && args?.[1] != null) {
          metadata.amount = String(args[1]);
          metadata.decodedSummary = `transfer(to=${args[0]}, amount=${args[1]})`;
        } else if (decoded.functionName === "approve" && args?.[0] != null && args?.[1] != null) {
          metadata.spender = String(args[0]);
          metadata.amount = String(args[1]);
          metadata.decodedSummary = `approve(spender=${args[0]}, amount=${args[1]})`;
        } else if (decoded.functionName === "transferFrom" && args?.[2] != null) {
          metadata.amount = String(args[2]);
          metadata.decodedSummary = `transferFrom(from=${args[0]}, to=${args[1]}, amount=${args[2]})`;
        }
      } catch {
        metadata.decodedSummary = undefined;
      }
      return { eventType, category: "erc20", metadata };
    }
  }

  // 3) ETH transfer: no data or 0x, value > 0
  const valueBn = BigInt(value);
  const noData = !data || data === "0x" || data.length <= 2;
  if (noData && valueBn > BigInt(0)) {
    return {
      eventType: "ETH_TRANSFER_PROPOSED",
      category: "eth_transfer",
      metadata: { ...baseMeta, amount: value },
    };
  }

  // 4) Fallback
  return {
    eventType: "CONTRACT_CALL_PROPOSED",
    category: "contract_call",
    metadata: { ...baseMeta, methodSignature: selector ?? undefined },
  };
}
