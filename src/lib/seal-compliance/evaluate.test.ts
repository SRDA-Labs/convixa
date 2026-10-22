import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateCompliance } from "./evaluate";
import type { ComplianceInput } from "./types";

function baseInput(overrides: Partial<ComplianceInput> = {}): ComplianceInput {
  return {
    threshold: 2,
    ownersCount: 3,
    classification: "operational",
    purpose: null,
    moduleExceptionNote: null,
    modulesCount: 0,
    estimatedUsd: 50_000,
    ...overrides,
  };
}

describe("seal-compliance evaluate", () => {
  it("passes healthy 2-of-3 config", () => {
    const summary = evaluateCompliance(baseInput());
    assert.equal(summary.fail, 0);
    const nOfN = summary.results.find((r) => r.ruleId === "no_n_of_n");
    assert.equal(nOfN?.status, "pass");
  });

  it("fails N-of-N configuration", () => {
    const summary = evaluateCompliance(
      baseInput({ threshold: 3, ownersCount: 3 })
    );
    const nOfN = summary.results.find((r) => r.ruleId === "no_n_of_n");
    assert.equal(nOfN?.status, "fail");
  });

  it("warns when high value has fewer than 7 signers", () => {
    const summary = evaluateCompliance(
      baseInput({ estimatedUsd: 2_000_000, ownersCount: 5, threshold: 3 })
    );
    const rule = summary.results.find((r) => r.ruleId === "high_value_7_signers");
    assert.equal(rule?.status, "warn");
  });

  it("fails threshold below 50%", () => {
    const summary = evaluateCompliance(
      baseInput({ threshold: 1, ownersCount: 5 })
    );
    const rule = summary.results.find((r) => r.ruleId === "threshold_50pct");
    assert.equal(rule?.status, "fail");
  });

  it("requires external signer on treasury safes", () => {
    const summary = evaluateCompliance(
      baseInput({
        classification: "treasury",
        roster: [
          {
            signerAddress: "0x1",
            signerType: "internal",
            roleLabel: "CTO",
            verificationStatus: "verified",
            verificationMethod: "siwe_affiliation",
            hardwareWallet: "ledger",
            isDedicatedSigner: true,
            removedAt: null,
          },
        ],
      })
    );
    const rule = summary.results.find((r) => r.ruleId === "external_signer_present");
    assert.equal(rule?.status, "fail");
  });

  it("passes when external signer present on treasury", () => {
    const summary = evaluateCompliance(
      baseInput({
        classification: "treasury",
        roster: [
          {
            signerAddress: "0x1",
            signerType: "security_partner",
            roleLabel: "Advisor",
            verificationStatus: "verified",
            verificationMethod: "siwe_affiliation",
            hardwareWallet: "ledger",
            isDedicatedSigner: true,
            removedAt: null,
          },
        ],
      })
    );
    const rule = summary.results.find((r) => r.ruleId === "external_signer_present");
    assert.equal(rule?.status, "pass");
  });
});
