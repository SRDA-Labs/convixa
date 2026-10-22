export type ProposeTemplate = "add" | "remove" | "rotate";

export type ProposeSafeOption = {
  id: string;
  address: string;
  network: string;
  name: string | null;
  threshold: number | null;
  owners: string[];
};

export type ProposeWizardState = {
  step: 1 | 2 | 3 | 4;
  template: ProposeTemplate | null;
  /** Add / remove target, or rotate new owner */
  primaryAddress: string;
  /** Rotate: old owner */
  secondaryAddress: string;
  threshold: string;
  selectedSafeIds: string[];
};

export const INITIAL_WIZARD_STATE: ProposeWizardState = {
  step: 1,
  template: null,
  primaryAddress: "",
  secondaryAddress: "",
  threshold: "1",
  selectedSafeIds: [],
};

export function templateLabel(t: ProposeTemplate): string {
  switch (t) {
    case "add":
      return "Add signer";
    case "remove":
      return "Remove signer";
    case "rotate":
      return "Rotate signer";
  }
}
