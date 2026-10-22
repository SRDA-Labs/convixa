import { createHealth, log } from "@convixa/shared";

const intervalMs = Number(process.env.WORKER_INTERVAL_MS || 5000);

function tick(): void {
  const health = createHealth("worker");
  log("worker", `heartbeat status=${health.status}`);
}

log("worker", `starting interval=${intervalMs}ms`);
tick();
setInterval(tick, intervalMs);

// Keep process alive for local/docker runs; CI only needs the build.
if (process.env.CI === "true" && process.env.WORKER_ONCE === "1") {
  process.exit(0);
}
