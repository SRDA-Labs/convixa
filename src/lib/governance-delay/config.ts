export function isTxSimulationEnabled(): boolean {
  return process.env.TX_SIMULATION_ENABLED !== "false";
}

export function getSimulationCacheTtlHours(): number {
  const raw = process.env.TX_SIMULATION_CACHE_TTL_HOURS;
  const n = raw ? parseInt(raw, 10) : 24;
  return Number.isFinite(n) && n > 0 ? n : 24;
}

export function isSafeWebhooksEnabled(): boolean {
  return process.env.SAFE_WEBHOOKS_ENABLED !== "false";
}

export function getWebhookBaseUrl(): string | null {
  return process.env.SAFE_WEBHOOK_BASE_URL?.trim() || null;
}
