import { describe, it, expect } from "vitest";
import {
  ruleOnboardingComplete,
  ruleDrillCurrent,
  rulePlaybooksPublished,
  ruleOnboardingTemplateConfigured,
} from "./phase4-rules";
import type { ComplianceInput } from "./types";

function baseInput(overrides: Partial<ComplianceInput> = {}): ComplianceInput {
  return {
    threshold: 2,
    ownersCount: 3,
    classification: "treasury",
    purpose: null,
    moduleExceptionNote: null,
    modulesCount: 0,
    estimatedUsd: 100000,
    ...overrides,
  };
}

describe("phase4-rules", () => {
  it("passes onboarding when 100% complete", () => {
    const result = ruleOnboardingComplete(
      baseInput({
        readiness: {
          onboardingTemplatesCount: 1,
          onboardingCompletionPct: 100,
          overdueDrills: 0,
          drillCompletedWithin90d: true,
          playbookScenariosPublished: 5,
          playbookScenariosExpected: 5,
          stalePlaybooks: 0,
        },
      })
    );
    expect(result.status).toBe("pass");
  });

  it("warns when drills overdue on protocol_critical", () => {
    const result = ruleDrillCurrent(
      baseInput({
        classification: "protocol_critical",
        readiness: {
          onboardingTemplatesCount: 1,
          onboardingCompletionPct: 100,
          overdueDrills: 2,
          drillCompletedWithin90d: false,
          playbookScenariosPublished: 5,
          playbookScenariosExpected: 5,
          stalePlaybooks: 0,
        },
      })
    );
    expect(result.status).toBe("fail");
  });

  it("warns when playbooks incomplete", () => {
    const result = rulePlaybooksPublished(
      baseInput({
        readiness: {
          onboardingTemplatesCount: 1,
          onboardingCompletionPct: 80,
          overdueDrills: 0,
          drillCompletedWithin90d: true,
          playbookScenariosPublished: 2,
          playbookScenariosExpected: 5,
          stalePlaybooks: 0,
        },
      })
    );
    expect(result.status).toBe("warn");
  });

  it("passes onboarding template configured", () => {
    const result = ruleOnboardingTemplateConfigured(
      baseInput({
        readiness: {
          onboardingTemplatesCount: 1,
          onboardingCompletionPct: 50,
          overdueDrills: 0,
          drillCompletedWithin90d: true,
          playbookScenariosPublished: 5,
          playbookScenariosExpected: 5,
          stalePlaybooks: 0,
        },
      })
    );
    expect(result.status).toBe("pass");
  });
});
