import type { ChecklistItemDef, ChecklistTemplateDef } from "./types";
import { normalizeSafeTxType } from "./tx-types";

export function resolveTemplate(
  templates: Array<{
    id?: string;
    name: string;
    classification: string | null;
    txCategories: string[] | null;
    itemsJson: ChecklistItemDef[] | null;
  }>,
  params: { classification: string | null; txCategory: string }
): { templateId?: string; name: string; items: ChecklistItemDef[] } | null {
  const category = normalizeSafeTxType(params.txCategory);

  const scored = templates
    .map((t) => {
      const cats = (t.txCategories ?? []).map((c) => normalizeSafeTxType(c));

      const catMatch =
        cats.length === 0 || cats.includes(category) || (category === "UNKNOWN" && cats.length > 0);
      if (!catMatch) return null;

      if (category !== "UNKNOWN" && cats.includes("UNKNOWN") && cats.length === 1) {
        return null;
      }

      const classMatch =
        !t.classification ||
        t.classification === params.classification ||
        !params.classification;

      if (!classMatch && t.classification && params.classification) {
        if (t.classification !== params.classification) return null;
      }

      let score = 0;
      if (cats.length === 1 && cats[0] === category) score += 30;
      else if (cats.includes(category)) score += 12;
      if (t.classification && t.classification === params.classification) score += 15;
      if (!t.classification) score += 3;
      if (category !== "UNKNOWN" && cats.includes("UNKNOWN")) score -= 40;

      return { t, score };
    })
    .filter(Boolean) as Array<{ t: (typeof templates)[0]; score: number }>;

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].t;
  const items = best.itemsJson ?? [];

  return {
    templateId: best.id,
    name: best.name,
    items,
  };
}

export function templateDefToRow(
  orgId: string,
  def: ChecklistTemplateDef,
  isDefault = true
) {
  return {
    orgId,
    name: def.name,
    classification: def.classification,
    txCategories: def.txCategories,
    itemsJson: def.items,
    isDefault,
  };
}
