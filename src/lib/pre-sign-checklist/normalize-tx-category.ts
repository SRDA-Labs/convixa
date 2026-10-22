import {
  classifySafeTransaction,
  normalizeSafeTxType,
  type ClassifySafeTransactionInput,
  type SafeTxType,
} from "./tx-types";

/**
 * Map any raw transaction label or Safe API fields to a canonical checklist type.
 */
export function normalizeTxCategoryForChecklist(
  raw: string,
  options?: ClassifySafeTransactionInput
): SafeTxType {
  if (options && (options.method || options.data || options.value || options.operation != null)) {
    const classified = classifySafeTransaction(options);
    if (classified !== "UNKNOWN") return classified;
  }
  return normalizeSafeTxType(raw, options);
}
