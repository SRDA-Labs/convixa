"use client";

import { useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useAddSafeModal } from "./add-safe-modal-provider";

/**
 * When the URL has addSafe=1 (e.g. after redirect from /dashboard/safes/new),
 * open the Add Safe modal and remove the query param.
 */
export function AddSafeModalOpenFromQuery() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const ctx = useAddSafeModal();

  useEffect(() => {
    if (!ctx || searchParams.get("addSafe") !== "1") return;
    ctx.setOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("addSafe");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router, ctx]);

  return null;
}
