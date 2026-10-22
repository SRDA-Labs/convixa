/**
 * Zod schemas for PolicyConfig (trigger, conditions, actions) for API validation.
 */

import { z } from "zod";

const triggerSchema = z.enum(["pending_tx", "approval", "config_change"]);

const conditionConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("amount_usd_greater_than"), value: z.number() }),
  z.object({
    type: z.literal("per_period_spend_usd"),
    period: z.enum(["day", "week", "month"]),
    limit: z.number(),
  }),
  z.object({
    type: z.literal("counterparty_in_list"),
    listId: z.string(),
    mode: z.enum(["allow", "deny"]),
  }),
  z.object({ type: z.literal("counterparty_not_in_list"), listId: z.string() }),
  z.object({ type: z.literal("safe_tag_in"), tags: z.array(z.string()) }),
  z.object({ type: z.literal("new_counterparty"), lookbackDays: z.number() }),
  z.object({ type: z.literal("approval_amount_usd_greater_than"), value: z.number() }),
  z.object({ type: z.literal("to_exchange"), listId: z.string() }),
  z.object({
    type: z.literal("time_of_day"),
    window: z.object({
      start: z.string(),
      end: z.string(),
      timezone: z.string(),
    }),
  }),
]);

const actionConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("alert"),
    severity: z.enum(["info", "warning", "critical"]),
    subscriptionListId: z.string().uuid().nullable(),
  }),
  z.object({
    type: z.literal("block"),
    reasonTemplate: z.string().optional(),
  }),
]);

export const policyConfigSchema = z.object({
  trigger: triggerSchema,
  conditions: z.array(conditionConfigSchema),
  actions: z.array(actionConfigSchema),
});

export type PolicyConfigInput = z.infer<typeof policyConfigSchema>;
