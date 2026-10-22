#!/usr/bin/env node
/**
 * Kill any process listening on the given port(s).
 * Usage: node scripts/kill-port.js [port1] [port2] ...
 * Used by predev so npm run dev doesn't fail with EADDRINUSE.
 */
const { spawnSync } = require("child_process");
const ports = process.argv.slice(2).map((p) => parseInt(p, 10)).filter((p) => p > 0);
if (ports.length === 0) {
  ports.push(3001); // default dev port
}
for (const port of ports) {
  try {
    // Use spawnSync with array args — no shell interpolation, no injection risk
    const result = spawnSync("lsof", ["-ti", `:${port}`], { encoding: "utf8" });
    const out = (result.stdout || "").trim();
    const pids = out.split(/\s+/).filter(Boolean);
    if (pids.length) {
      spawnSync("kill", ["-9", ...pids]);
      console.log(`Killed process(es) on port ${port}`);
    }
  } catch {
    // no process on port or lsof/kill failed
  }
}
