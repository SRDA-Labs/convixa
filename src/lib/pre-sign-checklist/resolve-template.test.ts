import { describe, expect, it } from "vitest";
import { CONVIXA_DEFAULT_TEMPLATES } from "./templates";
import { resolveTemplate } from "./resolve-template";

describe("resolveTemplate", () => {
  const templates = CONVIXA_DEFAULT_TEMPLATES.map((t, i) => ({
    id: `tpl-${i}`,
    name: t.name,
    classification: t.classification,
    txCategories: t.txCategories,
    itemsJson: t.items,
  }));

  it("picks native transfer checklist for NATIVE_TRANSFER", () => {
    const resolved = resolveTemplate(templates, {
      classification: null,
      txCategory: "NATIVE_TRANSFER",
    });
    expect(resolved?.name).toBe("Convixa Native Transfer");
  });

  it("picks delegate call checklist for DELEGATE_CALL", () => {
    const resolved = resolveTemplate(templates, {
      classification: null,
      txCategory: "DELEGATE_CALL",
    });
    expect(resolved?.name).toBe("Convixa Delegate Call");
  });

  it("falls back to standard review for UNKNOWN", () => {
    const resolved = resolveTemplate(templates, {
      classification: null,
      txCategory: "UNKNOWN",
    });
    expect(resolved?.name).toBe("Convixa Standard Review");
  });
});
