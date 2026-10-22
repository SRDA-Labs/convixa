import type { ChecklistItemDef, ChecklistTemplateDef } from "./types";
import type { SafeTxType } from "./tx-types";

/** Default fallback pre-sign checklist. */
export const CONVIXA_STANDARD_REVIEW_TEMPLATE_NAME = "Convixa Standard Review";

/** @deprecated Renamed to {@link CONVIXA_STANDARD_REVIEW_TEMPLATE_NAME}. */
export const LEGACY_GENERAL_REVIEW_TEMPLATE_NAME = "SEAL General pending tx";

const base = {
  decode: (label = "I reviewed decoded target, function, and parameters"): ChecklistItemDef => ({
    id: "decode_reviewed",
    label,
    type: "manual",
    required: true,
  }),
  notBlacklisted: {
    id: "not_blacklisted",
    label: "Destination not on org blacklist",
    type: "auto" as const,
    autoRule: "not_blacklisted",
    required: true,
  },
  safeAppMatch: {
    id: "safe_app_match",
    label: "Safe App preview matches this checklist summary",
    type: "manual" as const,
    required: true,
  },
  oobVerified: {
    id: "oob_case_verified",
    label: "Out-of-band verification case is verified (if required)",
    type: "manual" as const,
    required: true,
  },
  internalApproval: {
    id: "internal_approval_ref",
    label: "Internal approval reference documented (ticket/link)",
    type: "manual" as const,
    required: true,
  },
};

function template(
  name: string,
  txType: SafeTxType,
  items: ChecklistItemDef[],
  classification: string | null = null
): ChecklistTemplateDef {
  return { name, classification, txCategories: [txType], items };
}

/** Convixa default checklists — one per Safe transaction type. */
export const CONVIXA_DEFAULT_TEMPLATES: ChecklistTemplateDef[] = [
  template("Convixa Native Transfer", "NATIVE_TRANSFER", [
    base.decode("I reviewed recipient address and native amount"),
    base.notBlacklisted,
    {
      id: "destination_known",
      label: "Destination on address list or seen in transaction history",
      type: "auto",
      autoRule: "destination_known",
    },
    {
      id: "amount_within_policy",
      label: "Transfer amount within policy limit ($50k)",
      type: "auto",
      autoRule: "amount_within_policy",
    },
    {
      id: "new_counterparty_ack",
      label: "I acknowledge this is a new counterparty and approve",
      type: "manual",
      autoRule: "new_counterparty",
    },
    base.internalApproval,
    base.safeAppMatch,
  ]),
  template("Convixa ERC-20 Transfer", "ERC20_TRANSFER", [
    base.decode("I reviewed token contract, recipient, and transfer amount"),
    base.notBlacklisted,
    {
      id: "token_contract_verified",
      label: "Token contract address matches the intended asset",
      type: "manual",
      required: true,
    },
    {
      id: "destination_known",
      label: "Recipient on address list or seen in transaction history",
      type: "auto",
      autoRule: "destination_known",
    },
    base.safeAppMatch,
  ]),
  template("Convixa NFT Transfer", "ERC721_TRANSFER", [
    base.decode("I reviewed NFT contract, token ID, and recipient"),
    base.notBlacklisted,
    {
      id: "token_id_verified",
      label: "Token ID and collection match the intended NFT",
      type: "manual",
      required: true,
    },
    base.safeAppMatch,
  ]),
  template("Convixa Token Approval", "TOKEN_APPROVAL", [
    base.decode("I reviewed spender address and allowance amount"),
    {
      id: "spender_verified",
      label: "Spender contract is the intended protocol or address",
      type: "manual",
      required: true,
    },
    {
      id: "unlimited_allowance_ack",
      label: "I acknowledge unlimited/infinite allowance risk (if applicable)",
      type: "manual",
      autoRule: "new_counterparty",
    },
    base.safeAppMatch,
  ]),
  template("Convixa Contract Call", "CONTRACT_CALL", [
    base.decode(),
    base.notBlacklisted,
    {
      id: "contract_verified",
      label: "Target contract is the intended protocol deployment",
      type: "manual",
      required: true,
    },
    base.internalApproval,
    base.safeAppMatch,
  ]),
  template("Convixa Delegate Call", "DELEGATE_CALL", [
    base.decode("I reviewed delegate-call target and understand storage mutation risk"),
    {
      id: "delegate_target_verified",
      label: "Delegate-call target is trusted and expected for this Safe",
      type: "manual",
      required: true,
    },
    base.oobVerified,
    base.internalApproval,
    {
      id: "hardware_wallet_used",
      label: "I am signing from a hardware wallet",
      type: "manual",
      required: true,
    },
    base.safeAppMatch,
  ]),
  template("Convixa Batch Transaction", "BATCH_MULTISEND", [
    base.decode("I reviewed every transaction inside the batch"),
    {
      id: "batch_each_verified",
      label: "Each batched recipient, amount, and call data is correct",
      type: "manual",
      required: true,
    },
    base.notBlacklisted,
    base.internalApproval,
    base.safeAppMatch,
  ]),
  template("Convixa Module Execution", "MODULE_EXECUTION", [
    base.decode("I reviewed the module-triggered transaction"),
    {
      id: "module_verified",
      label: "Executing module is enabled and authorized on this Safe",
      type: "manual",
      required: true,
    },
    base.safeAppMatch,
  ]),
  template("Convixa Add Owner", "ADD_OWNER", [
    base.decode("I reviewed new owner address and updated threshold"),
    {
      id: "new_owner_verified",
      label: "New owner identity verified out-of-band",
      type: "manual",
      required: true,
    },
    base.oobVerified,
    base.safeAppMatch,
  ]),
  template("Convixa Remove Owner", "REMOVE_OWNER", [
    base.decode("I reviewed owner to remove and resulting threshold"),
    base.oobVerified,
    base.safeAppMatch,
  ]),
  template("Convixa Replace Owner", "REPLACE_OWNER", [
    base.decode("I reviewed old and new owner addresses"),
    {
      id: "replacement_verified",
      label: "Replacement owner identity verified out-of-band",
      type: "manual",
      required: true,
    },
    base.oobVerified,
    base.safeAppMatch,
  ]),
  template("Convixa Change Threshold", "CHANGE_THRESHOLD", [
    base.decode("I reviewed the new signature threshold"),
    base.oobVerified,
    base.internalApproval,
    base.safeAppMatch,
  ]),
  template("Convixa Set Guard", "SET_GUARD", [
    base.decode("I reviewed the guard contract address"),
    {
      id: "guard_contract_verified",
      label: "Guard contract audited and matches security policy",
      type: "manual",
      required: true,
    },
    base.oobVerified,
    base.safeAppMatch,
  ]),
  template("Convixa Set Fallback Handler", "SET_FALLBACK_HANDLER", [
    base.decode("I reviewed the fallback handler address"),
    base.oobVerified,
    base.safeAppMatch,
  ]),
  template("Convixa Enable Module", "ENABLE_MODULE", [
    base.decode("I reviewed the module to enable"),
    {
      id: "module_audit",
      label: "Module scope and permissions reviewed against security policy",
      type: "manual",
      required: true,
    },
    base.oobVerified,
    base.safeAppMatch,
  ]),
  template("Convixa Disable Module", "DISABLE_MODULE", [
    base.decode("I reviewed the module to disable"),
    base.oobVerified,
    base.safeAppMatch,
  ]),
  template("Convixa Approve Hash", "APPROVE_HASH", [
    {
      id: "hash_verified",
      label: "I verified the transaction hash matches the intended operation",
      type: "manual",
      required: true,
    },
    base.safeAppMatch,
  ]),
  template("Convixa Sign Message", "SIGN_MESSAGE", [
    {
      id: "message_content_verified",
      label: "I reviewed the full message content and signing intent",
      type: "manual",
      required: true,
    },
    base.safeAppMatch,
  ]),
  template(CONVIXA_STANDARD_REVIEW_TEMPLATE_NAME, "UNKNOWN", [
    base.decode("I reviewed transaction details"),
    base.notBlacklisted,
    base.safeAppMatch,
  ]),
];

/** @deprecated Use {@link CONVIXA_DEFAULT_TEMPLATES}. */
export const SEAL_DEFAULT_TEMPLATES = CONVIXA_DEFAULT_TEMPLATES;

export function getDefaultTemplatesForOrg(): ChecklistTemplateDef[] {
  return CONVIXA_DEFAULT_TEMPLATES;
}
