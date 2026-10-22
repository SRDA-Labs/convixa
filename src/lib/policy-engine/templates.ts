/**
 * Policy templates: preset trigger/condition/action configs for creating policies from the UI.
 */

import type { PolicyConfig } from "./config";

export type PolicyTemplate = {
  id: string;
  name: string;
  description: string;
  config: PolicyConfig;
};

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: "large_tx_usd",
    name: "Large transaction (USD)",
    description: "Alert when a pending native transfer exceeds a USD threshold.",
    config: {
      trigger: "pending_tx",
      conditions: [{ type: "amount_usd_greater_than", value: 50_000 }],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "cold_wallet_activity",
    name: "Cold wallet activity",
    description: "Alert on any pending transaction for safes tagged as cold.",
    config: {
      trigger: "pending_tx",
      conditions: [{ type: "safe_tag_in", tags: ["cold"] }],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "malicious_list",
    name: "Destination blacklist",
    description: "Alert when a pending tx sends to a blacklisted (malicious) address.",
    config: {
      trigger: "pending_tx",
      conditions: [{ type: "counterparty_in_list", listId: "__blacklist__", mode: "deny" }],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "approval_amount_threshold",
    name: "Approval amount threshold",
    description: "Alert when a pending transaction value exceeds a USD threshold.",
    config: {
      trigger: "pending_tx",
      conditions: [{ type: "approval_amount_usd_greater_than", value: 10_000 }],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "multisig_activity",
    name: "Multisig Activity",
    description: "Alert when there is any pending transaction on the safe.",
    config: {
      trigger: "pending_tx",
      conditions: [],
      actions: [{ type: "alert", severity: "info", subscriptionListId: null }],
    },
  },
  {
    id: "allowlist",
    name: "Allowlist",
    description: "Alert and block when destination is not in the selected allowlist.",
    config: {
      trigger: "pending_tx",
      conditions: [{ type: "counterparty_not_in_list", listId: "" }],
      actions: [
        { type: "alert", severity: "warning", subscriptionListId: null },
        { type: "block", reasonTemplate: "Destination not in allowlist" },
      ],
    },
  },
  {
    id: "to_exchange",
    name: "Transfer to exchange",
    description: "Alert when a pending tx sends to an address in the exchange list.",
    config: {
      trigger: "pending_tx",
      conditions: [{ type: "to_exchange", listId: "" }],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "new_counterparty",
    name: "New counterparty",
    description: "Alert when sending to an address not seen in the lookback period (requires history).",
    config: {
      trigger: "pending_tx",
      conditions: [{ type: "new_counterparty", lookbackDays: 30 }],
      actions: [{ type: "alert", severity: "info", subscriptionListId: null }],
    },
  },
  {
    id: "per_period_spend",
    name: "Per-period spend limit",
    description: "Alert when spend in the period exceeds limit (requires history).",
    config: {
      trigger: "pending_tx",
      conditions: [{ type: "per_period_spend_usd", period: "month", limit: 100_000 }],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "time_of_day",
    name: "Time-of-day window",
    description: "Alert when a pending transaction occurs during the specified time window. Set business hours to flag after-hours activity, or overnight hours to monitor unusual wallet usage.",
    config: {
      trigger: "pending_tx",
      conditions: [{ type: "time_of_day", window: { start: "00:00", end: "06:00", timezone: "UTC" } }],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "new_counterparty_large_tx",
    name: "New counterparty large tx",
    description: "Alert when sending a large amount to an address not seen in the lookback period (requires history).",
    config: {
      trigger: "pending_tx",
      conditions: [
        { type: "new_counterparty", lookbackDays: 30 },
        { type: "amount_usd_greater_than", value: 5_000 },
      ],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "exchange_tx_monitor",
    name: "Exchange / off-ramp monitoring",
    description: "Alert when a pending tx sends to an exchange list and exceeds a USD threshold.",
    config: {
      trigger: "pending_tx",
      conditions: [
        { type: "to_exchange", listId: "" },
        { type: "amount_usd_greater_than", value: 1_000 },
      ],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "config_change_alert",
    name: "Config / owner change alert",
    description: "Alert on any Safe config or owner change (signer add/remove/swap, threshold change).",
    config: {
      trigger: "config_change",
      conditions: [],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "signer_added",
    name: "Signer added",
    description: "Alert when a new signer is proposed to be added to the Safe.",
    config: {
      trigger: "config_change",
      conditions: [{ type: "event_type_in", eventTypes: ["SIGNER_ADD_PROPOSED"] }],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "signer_removed",
    name: "Signer removed",
    description: "Alert when a signer is proposed to be removed from the Safe.",
    config: {
      trigger: "config_change",
      conditions: [{ type: "event_type_in", eventTypes: ["SIGNER_REMOVE_PROPOSED"] }],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "threshold_change",
    name: "Threshold change",
    description: "Alert when the Safe's confirmation threshold is proposed to change.",
    config: {
      trigger: "config_change",
      conditions: [{ type: "event_type_in", eventTypes: ["THRESHOLD_CHANGE_PROPOSED"] }],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "balance_drained",
    name: "Balance drained",
    description: "Alert when a Safe's balance drops by more than 50% in 1 hour.",
    config: {
      trigger: "balance_change",
      conditions: [{ type: "balance_change_pct", threshold: -50, lookbackMinutes: 60 }],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "seal_threshold_decrease",
    name: "SEAL: Threshold decrease proposed",
    description: "Critical alert when a pending tx proposes lowering the Safe threshold.",
    config: {
      trigger: "config_change",
      conditions: [{ type: "event_type_in", eventTypes: ["THRESHOLD_CHANGE_PROPOSED"] }],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "seal_signer_removal",
    name: "SEAL: Signer removal proposed",
    description: "Critical alert when a pending tx proposes removing a signer.",
    config: {
      trigger: "config_change",
      conditions: [{ type: "event_type_in", eventTypes: ["SIGNER_REMOVE_PROPOSED"] }],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "seal_guard_module_change",
    name: "SEAL: Guard or module change proposed",
    description: "Alert when guard, fallback handler, or module changes are proposed.",
    config: {
      trigger: "config_change",
      conditions: [
        {
          type: "event_type_in",
          eventTypes: [
            "GUARD_SET_PROPOSED",
            "FALLBACK_HANDLER_SET_PROPOSED",
            "MODULE_CHANGE_PROPOSED",
          ],
        },
      ],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "seal_unverified_signers",
    name: "SEAL: Unverified signers on treasury Safe",
    description: "Alert when treasury or protocol-critical safes have unverified roster signers.",
    config: {
      trigger: "pending_tx",
      conditions: [],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "seal_missing_external_signer",
    name: "SEAL: Missing external signer",
    description: "Alert when a treasury/protocol safe has no external advisor or security partner.",
    config: {
      trigger: "pending_tx",
      conditions: [],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "seal_pending_tx_unreviewed",
    name: "SEAL: Unreviewed pending tx on treasury Safe",
    description: "Alert when pending txs on treasury/protocol safes lack completed signer reviews.",
    config: {
      trigger: "pending_tx",
      conditions: [],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "seal_governance_without_oob",
    name: "SEAL: Governance change without OOB case",
    description: "Alert when critical governance is proposed without an OOB verification case.",
    config: {
      trigger: "config_change",
      conditions: [
        {
          type: "event_type_in",
          eventTypes: ["SIGNER_REMOVE_PROPOSED", "THRESHOLD_CHANGE_PROPOSED"],
        },
      ],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "seal_oob_verification_overdue",
    name: "SEAL: OOB verification overdue",
    description: "Alert when OOB verification cases pass their SLA deadline.",
    config: {
      trigger: "config_change",
      conditions: [],
      actions: [{ type: "alert", severity: "critical", subscriptionListId: null }],
    },
  },
  {
    id: "seal_drill_overdue",
    name: "SEAL: Emergency drill overdue",
    description: "Alert when scheduled emergency drills pass their due date.",
    config: {
      trigger: "config_change",
      conditions: [],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
  {
    id: "seal_onboarding_incomplete",
    name: "SEAL: Signer onboarding incomplete",
    description: "Alert when signers remain incomplete on onboarding past SLA.",
    config: {
      trigger: "pending_tx",
      conditions: [],
      actions: [{ type: "alert", severity: "warning", subscriptionListId: null }],
    },
  },
];
