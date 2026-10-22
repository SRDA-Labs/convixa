"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

export function CopyInviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const url = `${window.location.origin}/invite/accept?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [token]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px] min-w-[44px] justify-center"
      aria-label={copied ? "Link copied" : "Copy invite link"}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600 shrink-0" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Copy link
        </>
      )}
    </button>
  );
}
