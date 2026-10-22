#!/usr/bin/env npx tsx
/**
 * Export PolicyGuard and module contract artifacts (ABI + bytecode) to public/ for in-app and API deploy.
 * Sources (in order):
 * 1. contracts/out (Foundry build in this repo) - run "forge build" first
 * 2. ../inventory/public/contracts/policy-guard-artifacts.json (if inventory exists alongside)
 * Output: public/contracts/policy-guard-artifacts.json
 */

import * as fs from "fs";
import * as path from "path";

const CONTRACTS = [
  "PolicyGuard",
  "BlocklistPolicyModule",
  "SanctionsOraclePolicyModule",
  "MaxValuePolicyModule",
  "TimeWindowPolicyModule",
  "AllowlistPolicyModule",
];

const OUT_DIR = path.join(process.cwd(), "contracts/out");
const PUBLIC_DIR = path.join(process.cwd(), "public/contracts");
const OUTPUT_FILE = path.join(PUBLIC_DIR, "policy-guard-artifacts.json");
const INVENTORY_ARTIFACTS = path.join(process.cwd(), "../inventory/public/contracts/policy-guard-artifacts.json");

function loadArtifact(name: string): { abi: unknown[]; bytecode: string } | null {
  const candidates = [
    path.join(OUT_DIR, `${name}.sol`, `${name}.json`),
    path.join(OUT_DIR, name, `${name}.json`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, "utf-8"));
      const bytecode = j.bytecode?.object ?? "0x";
      return { abi: j.abi, bytecode };
    }
  }
  return null;
}

function main() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  // Try local Foundry build first
  const artifacts: Record<string, { abi: unknown[]; bytecode: string }> = {};
  let hasAny = false;
  for (const name of CONTRACTS) {
    const art = loadArtifact(name);
    if (art) {
      artifacts[name] = art;
      hasAny = true;
    }
  }

  if (hasAny && Object.keys(artifacts).length === CONTRACTS.length) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(artifacts), "utf-8");
    console.log("Wrote", OUTPUT_FILE, "(from local forge build)");
    return;
  }

  // Fallback: copy from inventory if it exists
  if (fs.existsSync(INVENTORY_ARTIFACTS)) {
    fs.copyFileSync(INVENTORY_ARTIFACTS, OUTPUT_FILE);
    console.log("Wrote", OUTPUT_FILE, "(copied from ../inventory)");
    return;
  }

  if (!hasAny) {
    console.error(
      "Policy guard artifacts not found. Either:\n" +
        "  1. Run 'forge build' in a repo with PolicyGuard contracts, then re-run this script\n" +
        "  2. Ensure ../inventory/public/contracts/policy-guard-artifacts.json exists"
    );
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(artifacts), "utf-8");
  console.log("Wrote", OUTPUT_FILE, "(partial - some artifacts missing)");
}

main();
