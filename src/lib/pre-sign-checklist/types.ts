export type ChecklistItemType = "auto" | "manual";

export type ChecklistItemDef = {
  id: string;
  label: string;
  type: ChecklistItemType;
  autoRule?: string;
  required?: boolean;
};

export type ChecklistTemplateDef = {
  name: string;
  classification: string | null;
  txCategories: string[];
  items: ChecklistItemDef[];
};

export type AutoSeverity = "pass" | "warn" | "fail";

export type EvaluatedChecklistItem = ChecklistItemDef & {
  autoResult?: boolean | null;
  autoMessage?: string;
  autoSeverity?: AutoSeverity;
  autoAction?: { href: string; label: string };
  applicable: boolean;
};

export type ItemState = {
  completed: boolean;
  autoResult?: boolean;
  note?: string;
  completedAt?: string;
};

export type ReviewStatus = "in_progress" | "completed" | "signed";
