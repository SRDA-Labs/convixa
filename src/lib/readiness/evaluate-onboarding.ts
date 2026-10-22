import type { OnboardingItemDef } from "./onboarding-templates";

export type OnboardingEvalContext = {
  verificationStatus: string;
  hasTestnetDrill: boolean;
};

export type OnboardingItemState = {
  completed: boolean;
  autoResult?: boolean;
  note?: string;
  completedAt?: string;
};

export async function evaluateOnboardingAutoRule(
  rule: string,
  ctx: OnboardingEvalContext
): Promise<{ pass: boolean; message: string; applicable: boolean }> {
  if (rule === "affiliation_verified") {
    const pass = ctx.verificationStatus === "verified";
    return {
      pass,
      message: pass ? "Affiliation verified" : "Affiliation not verified",
      applicable: true,
    };
  }

  if (rule === "drill_completed_testnet") {
    const pass = ctx.hasTestnetDrill;
    return {
      pass,
      message: pass ? "Testnet drill completed" : "No testnet drill on record",
      applicable: true,
    };
  }

  return { pass: false, message: "Unknown auto rule", applicable: false };
}

export function isOnboardingComplete(
  items: OnboardingItemDef[],
  state: Record<string, OnboardingItemState>
): boolean {
  for (const item of items) {
    if (item.required === false) continue;
    const s = state[item.id];
    if (!s?.completed) return false;
  }
  return true;
}

export function onboardingCompletionPercent(
  items: OnboardingItemDef[],
  state: Record<string, OnboardingItemState>
): number {
  const required = items.filter((i) => i.required !== false);
  if (required.length === 0) return 100;
  const done = required.filter((i) => state[i.id]?.completed).length;
  return Math.round((done / required.length) * 100);
}
