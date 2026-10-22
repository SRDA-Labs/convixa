import { describe, it, expect } from "vitest";
import {
  ruleTimelockPresent,
  ruleTestnetTwinConfigured,
  rulePolicyGapCritical,
} from "./phase5-rules";
import type { ComplianceInput } from "./types";

function baseInput(overrides: Partial<ComplianceInput> = {}): ComplianceInput {
  return {
    threshold: 2,
    ownersCount: 3,
    classification: "protocol_critical",
    purpose: null,
    moduleExceptionNote: null,
    modulesCount: 0,
    estimatedUsd: 1_000_000,
    ...overrides,
  };
}

describe("phase5-rules", () => {
  it("fails timelock when strict safe has no delays", () => {
    const r = ruleTimelockPresent(
      baseInput({ governance: { delayAttachmentCount: 0 } as ComplianceInput["governance"] })
    );
    expect(r.status).toBe("fail");
  });

  it("passes timelock when delay module present", () => {
    const r = ruleTimelockPresent(
      baseInput({ governance: { delayAttachmentCount: 1 } as ComplianceInput["governance"] })
    );
    expect(r.status).toBe("pass");
  });

  it("warns when no testnet twin on treasury", () => {
    const r = ruleTestnetTwinConfigured(
      baseInput({
        classification: "treasury",
        governance: { hasTestnetTwin: false } as ComplianceInput["governance"],
      })
    );
    expect(r.status).toBe("warn");
  });

  it("fails on critical policy gaps", () => {
    const r = rulePolicyGapCritical(
      baseInput({
        policyGaps: [
          {
            id: "no_delay",
            severity: "critical",
            category: "Timelock",
            message: "No delay",
            remediation: "Fix",
          },
        ],
      })
    );
    expect(r.status).toBe("fail");
  });
});
