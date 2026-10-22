import { describe, it, expect } from "vitest";
import {
  ruleChecklistTemplateConfigured,
  rulePendingReviewsCurrent,
  ruleOobCaseOpenForGovernance,
  ruleIncidentContactConfigured,
} from "./phase3-rules";
import type { ComplianceInput } from "./types";

function baseInput(overrides: Partial<ComplianceInput> = {}): ComplianceInput {
  return {
    threshold: 2,
    ownersCount: 3,
    classification: "treasury",
    purpose: "Treasury ops",
    moduleExceptionNote: null,
    modulesCount: 0,
    estimatedUsd: 100_000,
    ...overrides,
  };
}

describe("Phase 3 compliance rules", () => {
  it("warns when no checklist templates on treasury safe", () => {
    const result = ruleChecklistTemplateConfigured(
      baseInput({ operational: { checklistTemplatesCount: 0, pendingTxsWithoutReview: 0, openOobCases: 0, overdueOobCases: 0, unverifiedGovernanceEvents7d: 0, proposedGovernanceWithoutOob: 0, hasSecurityContact: true } })
    );
    expect(result.status).toBe("warn");
  });

  it("passes when templates exist", () => {
    const result = ruleChecklistTemplateConfigured(
      baseInput({ operational: { checklistTemplatesCount: 4, pendingTxsWithoutReview: 0, openOobCases: 0, overdueOobCases: 0, unverifiedGovernanceEvents7d: 0, proposedGovernanceWithoutOob: 0, hasSecurityContact: true } })
    );
    expect(result.status).toBe("pass");
  });

  it("warns on pending txs without reviews", () => {
    const result = rulePendingReviewsCurrent(
      baseInput({ operational: { checklistTemplatesCount: 1, pendingTxsWithoutReview: 2, openOobCases: 0, overdueOobCases: 0, unverifiedGovernanceEvents7d: 0, proposedGovernanceWithoutOob: 0, hasSecurityContact: true } })
    );
    expect(result.status).toBe("warn");
    expect(result.message).toContain("2");
  });

  it("warns when governance lacks OOB case", () => {
    const result = ruleOobCaseOpenForGovernance(
      baseInput({ operational: { checklistTemplatesCount: 1, pendingTxsWithoutReview: 0, openOobCases: 0, overdueOobCases: 0, unverifiedGovernanceEvents7d: 0, proposedGovernanceWithoutOob: 1, hasSecurityContact: true } })
    );
    expect(result.status).toBe("warn");
  });

  it("warns when security contact not configured", () => {
    const result = ruleIncidentContactConfigured(
      baseInput({ operational: { checklistTemplatesCount: 1, pendingTxsWithoutReview: 0, openOobCases: 0, overdueOobCases: 0, unverifiedGovernanceEvents7d: 0, proposedGovernanceWithoutOob: 0, hasSecurityContact: false } })
    );
    expect(result.status).toBe("warn");
  });

  it("skips strict rules for operational classification", () => {
    const result = rulePendingReviewsCurrent(
      baseInput({ classification: "operational", operational: undefined })
    );
    expect(result.status).toBe("pass");
  });
});
