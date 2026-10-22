export type OnboardingItemDef = {
  id: string;
  label: string;
  type: "auto" | "manual";
  autoRule?: string;
  required?: boolean;
};

export type OnboardingTemplateDef = {
  name: string;
  items: OnboardingItemDef[];
};

export const CONVIXA_DEFAULT_ONBOARDING_TEMPLATE_NAME = "Convixa Signer Onboarding";

export const CONVIXA_DEFAULT_ONBOARDING_ITEMS: OnboardingItemDef[] = [
  {
    id: "hw_wallet_confirmed",
    label: "Hardware wallet used for this signer key",
    type: "manual",
    required: true,
  },
  {
    id: "affiliation_signed",
    label: "Affiliation message signed for this Safe",
    type: "auto",
    autoRule: "affiliation_verified",
    required: true,
  },
  {
    id: "operating_charter_read",
    label: "Read org multisig operating charter",
    type: "manual",
    required: true,
  },
  {
    id: "comms_channel_joined",
    label: "Added to dedicated signer comms channel",
    type: "manual",
    required: true,
  },
  {
    id: "testnet_drill_done",
    label: "Completed testnet signing drill",
    type: "auto",
    autoRule: "drill_completed_testnet",
    required: false,
  },
  {
    id: "oob_process_understood",
    label: "Understands OOB verification for admin changes",
    type: "manual",
    required: true,
  },
];

export const CONVIXA_DEFAULT_ONBOARDING_TEMPLATE: OnboardingTemplateDef = {
  name: CONVIXA_DEFAULT_ONBOARDING_TEMPLATE_NAME,
  items: CONVIXA_DEFAULT_ONBOARDING_ITEMS,
};
