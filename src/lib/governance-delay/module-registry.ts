export type DelayAttachmentType =
  | "zodiac_delay"
  | "timelock_module"
  | "guard_delay"
  | "unknown_delay";

export type ModuleFingerprint = {
  type: DelayAttachmentType;
  namePatterns: RegExp[];
  defaultDelaySeconds?: number;
};

/** Known delay-related module name / type patterns (case-insensitive). */
export const DELAY_MODULE_FINGERPRINTS: ModuleFingerprint[] = [
  {
    type: "zodiac_delay",
    namePatterns: [/delay/i, /zodiac.*delay/i, /delay.*modifier/i],
    defaultDelaySeconds: 86400,
  },
  {
    type: "timelock_module",
    namePatterns: [/timelock/i, /time.?lock/i, /cooldown/i],
    defaultDelaySeconds: 172800,
  },
];

export function classifyModuleForDelay(module: {
  address: string;
  name?: string | null;
}): {
  type: DelayAttachmentType;
  delaySeconds: number | null;
  label: string;
} | null {
  const name = module.name ?? "";
  for (const fp of DELAY_MODULE_FINGERPRINTS) {
    if (fp.namePatterns.some((p) => p.test(name))) {
      return {
        type: fp.type,
        delaySeconds: fp.defaultDelaySeconds ?? null,
        label: name || fp.type,
      };
    }
  }
  if (/delay|timelock|cooldown/i.test(name)) {
    return {
      type: "unknown_delay",
      delaySeconds: null,
      label: name || "delay module",
    };
  }
  return null;
}
