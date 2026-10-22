import type { SimulationResult } from "./tenderly-client";

export type RiskFlag = { severity: "info" | "warn" | "critical"; message: string };

export function extractRiskFlags(result: SimulationResult): RiskFlag[] {
  const flags: RiskFlag[] = result.riskFlags.map((f) => ({
    severity: (f.severity as RiskFlag["severity"]) ?? "info",
    message: f.message,
  }));

  if (result.status === "failed") {
    flags.push({
      severity: "warn",
      message: "Simulation did not complete successfully",
    });
  }

  if (result.status === "skipped") {
    flags.push({
      severity: "info",
      message: "Simulation skipped — provider not configured",
    });
  }

  return flags;
}

export function hasCriticalRiskFlags(flags: RiskFlag[]): boolean {
  return flags.some((f) => f.severity === "critical");
}
