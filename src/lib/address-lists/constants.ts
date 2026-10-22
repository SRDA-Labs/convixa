import type { AddressListType } from "@/lib/db/schema/address-lists.schema";
import { ADDRESS_LIST_TYPES } from "@/lib/db/schema/address-lists.schema";

/** Lists where each entry is a named contact (vendor, sponsor, token). */
export const DIRECTORY_LIST_TYPES = ["vendors", "sponsors", "token_contracts"] as const;
export type DirectoryListType = (typeof DIRECTORY_LIST_TYPES)[number];

/** Plain address sets for policies and monitoring — no per-entry names required. */
export const WATCHLIST_TYPE = "watchlist" as const;

export function isDirectoryList(type: string): type is DirectoryListType {
  return (DIRECTORY_LIST_TYPES as readonly string[]).includes(type);
}

export function isWatchlist(type: string): boolean {
  return type === WATCHLIST_TYPE;
}

export function isValidAddressListType(type: string | null | undefined): type is AddressListType {
  return !!type && (ADDRESS_LIST_TYPES as readonly string[]).includes(type);
}

export function resolveAddressListTypeLabel(type: string | null | undefined): string {
  if (!isValidAddressListType(type)) return UNASSIGNED_TYPE_LABEL;
  return LIST_TYPE_LABEL[type];
}

export const UNASSIGNED_TYPE_LABEL = "Category not set";

export const LIST_TYPE_LABEL: Record<AddressListType, string> = {
  vendors: "Vendor directory",
  sponsors: "Sponsor directory",
  token_contracts: "Token directory",
  watchlist: "Address watchlist",
};

export const LIST_TYPE_DESCRIPTION: Record<AddressListType, string> = {
  vendors:
    "Named vendor contacts — save treasury addresses with labels (e.g. Acme Corp) for identification in checklists and policies.",
  sponsors:
    "Named sponsor contacts with labels for grants, partnerships, and outbound payments.",
  token_contracts:
    "Named token contract addresses (e.g. USDC, WETH) for transfer and approval reviews.",
  watchlist:
    "Address-only list for policy allowlists and monitoring. No names required — bulk-add raw addresses.",
};

export const DIRECTORY_LABEL_PLACEHOLDER: Record<DirectoryListType, string> = {
  vendors: "e.g. Acme Corp Treasury",
  sponsors: "e.g. Protocol Foundation",
  token_contracts: "e.g. USDC (Ethereum)",
};

/** Top-level choice when creating a new list under Controls → Lists */
export const LIST_CREATION_KINDS = ["alert_subscription", "onchain_address_book"] as const;
export type ListCreationKind = (typeof LIST_CREATION_KINDS)[number];

export const LIST_CREATION_KIND_LABEL: Record<ListCreationKind, string> = {
  alert_subscription: "Alert subscription list",
  onchain_address_book: "On-chain address book",
};

export const LIST_CREATION_KIND_DESCRIPTION: Record<ListCreationKind, string> = {
  alert_subscription:
    "Group org members who receive alert emails when rules fire. Pick people with Convixa accounts — used by alert rules and policies.",
  onchain_address_book:
    "Map named Web3 counterparties (e.g. SaaS vendors) to on-chain addresses. Used in signer checklists, policies, and allowlists.",
};
