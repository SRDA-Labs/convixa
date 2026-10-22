"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Radio, ChevronDown, ChevronUp, Plus, Loader2, X } from "lucide-react";
import { useAddSafeModal } from "@/components/add-safe-modal-provider";

const DISMISS_STORAGE_KEY = "convixa_discovered_wallet_dismissed";

type DiscoveredItem = {
  address: string;
  network: string;
  chainId: number;
  chainName?: string;
  threshold: number;
  owners?: string[];
};

function truncateAddress(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function DiscoveredFromWallet() {
  const router = useRouter();
  const addSafeModal = useAddSafeModal();
  const [discovered, setDiscovered] = useState<DiscoveredItem[]>([]);
  const [hasLinkedWallet, setHasLinkedWallet] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [floatingPanelOpen, setFloatingPanelOpen] = useState(false);
  const [importAllOpen, setImportAllOpen] = useState(false);
  const [importTeamId, setImportTeamId] = useState("");
  const [teams, setTeams] = useState<{ teamId: string; teamName: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; failed: number } | null>(null);

  const fetchDiscovered = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/discovered-safes");
      const data = await res.json().catch(() => ({}));
      setDiscovered(data.discovered ?? []);
      setHasLinkedWallet(data.hasLinkedWallet ?? false);
    } catch {
      setDiscovered([]);
      setHasLinkedWallet(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscovered();
  }, [fetchDiscovered]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
      setDismissed(stored === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (!importAllOpen) return;
    fetch("/api/teams")
      .then((r) => r.json())
      .then((d) => {
        if (d.teams?.length) {
          setTeams(d.teams);
          if (!importTeamId) setImportTeamId(d.teams[0].teamId);
        }
      })
      .catch(() => {});
  }, [importAllOpen]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, "true");
    } catch {}
    setDismissed(true);
  };

  const handleReopen = () => {
    try {
      localStorage.removeItem(DISMISS_STORAGE_KEY);
    } catch {}
    setDismissed(false);
    setExpanded(true);
  };

  const openFloatingPanel = () => setFloatingPanelOpen(true);
  const closeFloatingPanel = () => setFloatingPanelOpen(false);

  const handleAddOne = (item: DiscoveredItem) => {
    addSafeModal?.setOpen(true, {
      address: item.address,
      network: item.network,
      name: item.chainName ? `${item.chainName} Safe` : undefined,
    });
    // After add, parent or modal success can trigger refresh; we re-fetch when modal closes via polling or we listen to success.
    // Simpler: re-fetch after a short delay when modal might have closed (user adds safe). Alternatively expose onSuccess from provider.
    // Plan: "After adding, refresh discovered list (re-fetch) so that safe disappears." So we need to re-fetch when Add Safe modal closes after a successful add. The Add Safe modal on success calls router.push and router.refresh() - it doesn't tell DiscoveredFromWallet. So we could: (1) re-fetch discovered periodically while modal is open, or (2) re-fetch when modal closes (provider would need to expose onClose callback). Easiest: when user clicks Add we open modal; when they come back to the page (e.g. after adding and navigating to safe detail, or after closing modal), the inventory page might re-render. If they stay on the same page and just close the modal after adding, we need to re-fetch. So let's add a window focus or interval re-fetch when the box is visible. Or: the Add Safe modal's onSuccess goes to the safe page, so when they add from discovered they leave the inventory page. When they come back, the page loads and we fetch discovered again. So we're good. If they add and then don't navigate (e.g. form just closes without redirect?), we'd need to re-fetch. Looking at AddSafeForm - onSuccess it does router.push and router.refresh(). So they always navigate away. So we're good. When they open "Add" from discovered and then cancel (close modal without adding), no re-fetch needed. So no extra logic for "after add".
  };

  const handleImportAll = async () => {
    if (!importTeamId || discovered.length === 0) return;
    setImporting(true);
    setImportResult(null);
    let added = 0;
    let failed = 0;
    for (const item of discovered) {
      try {
        const res = await fetch("/api/safes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId: importTeamId,
            address: item.address,
            network: item.network,
            name: "Unnamed",
          }),
        });
        if (res.ok) added++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setImportResult({ added, failed });
    setImporting(false);
    if (added > 0) {
      await fetchDiscovered();
      router.refresh();
    }
    if (failed === 0) setImportAllOpen(false);
  };

  if (hasLinkedWallet === false || (hasLinkedWallet === true && discovered.length === 0 && !loading)) {
    return null;
  }
  if (loading && hasLinkedWallet === null) return null;

  if (dismissed && discovered.length > 0) {
    return (
      <>
        {/* Floating panel: small box in lower right when icon is clicked */}
        {floatingPanelOpen && (
          <>
            <button
              type="button"
              onClick={closeFloatingPanel}
              className="fixed inset-0 z-10"
              aria-label="Close panel"
            />
            <div
              className="fixed bottom-24 right-6 z-20 w-80 max-h-[min(70vh,24rem)] flex flex-col rounded-xl border border-border bg-card shadow-lg overflow-hidden"
              role="dialog"
              aria-labelledby="discovered-floating-title"
            >
              <div className="shrink-0 flex items-center justify-between gap-2 p-3 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <Radio className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  <h2 id="discovered-floating-title" className="font-semibold text-sm text-foreground truncate">
                    Discovered from Wallet
                  </h2>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0">
                    {discovered.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closeFloatingPanel}
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <ul className="divide-y divide-border">
                  {discovered.map((item) => (
                    <li
                      key={`${item.address}:${item.network}`}
                      className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/20"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm truncate">
                          {item.chainName ?? "Unnamed"}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground truncate" title={item.address}>
                          {truncateAddress(item.address)} · {item.network}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddOne(item)}
                        className="shrink-0 inline-flex items-center justify-center rounded-md border border-primary bg-primary/10 p-1.5 text-primary hover:bg-primary/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[32px] min-w-[32px]"
                        aria-label={`Add ${truncateAddress(item.address)}`}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="shrink-0 flex flex-col gap-2 p-3 border-t border-border bg-muted/20">
                <button
                  type="button"
                  onClick={() => setImportAllOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  Import All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDismiss();
                    closeFloatingPanel();
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded"
                >
                  Don&apos;t show again
                </button>
              </div>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={floatingPanelOpen ? closeFloatingPanel : openFloatingPanel}
          title={`${discovered.length} discovered from wallet – Add`}
          className="fixed bottom-10 right-6 z-10 flex items-center justify-center size-10 rounded-full border border-border bg-card shadow-md text-primary hover:bg-muted/50 hover:border-primary/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${discovered.length} discovered from wallet – Add`}
          aria-expanded={floatingPanelOpen}
        >
          <Radio className="h-5 w-5 shrink-0" aria-hidden />
        </button>
        {importAllOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-all-title"
          >
            <button
              type="button"
              onClick={() => !importing && setImportAllOpen(false)}
              className="absolute inset-0 -z-10"
              aria-label="Close"
            />
            <div
              className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-lg p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="import-all-title" className="text-lg font-semibold text-foreground mb-4">
                Add all to team
              </h2>
              <div className="mb-4">
                <label htmlFor="import-all-team" className="block text-sm font-medium text-foreground mb-1.5">
                  Team
                </label>
                <select
                  id="import-all-team"
                  value={importTeamId}
                  onChange={(e) => setImportTeamId(e.target.value)}
                  disabled={importing}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[44px]"
                >
                  {teams.map((t) => (
                    <option key={t.teamId} value={t.teamId}>
                      {t.teamName}
                    </option>
                  ))}
                </select>
              </div>
              {importResult && (
                <p className="mb-4 text-sm text-muted-foreground">
                  {importResult.added} added, {importResult.failed} failed.
                </p>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => !importing && setImportAllOpen(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
                >
                  {importResult ? "Close" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleImportAll}
                  disabled={importing || !importTeamId}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px]"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                      Adding {discovered.length} safes…
                    </>
                  ) : (
                    "Add all"
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => !importing && setImportAllOpen(false)}
                className="absolute top-4 right-4 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="h-5 w-5 text-primary shrink-0" aria-hidden />
            <div>
              <h3 className="font-semibold text-foreground">Discovered from Wallet</h3>
              <p className="text-xs text-muted-foreground">Individual multisig safes found on your connected wallet.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {discovered.length} DETECTED
            </span>
            <button
              type="button"
              onClick={() => setImportAllOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
            >
              Import All
            </button>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
              aria-label={expanded ? "Collapse list" : "Show list"}
            >
              {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded"
          >
            Don&apos;t show again
          </button>
        </div>

        {expanded && (
          <div className="border-t border-border">
            <ul className="divide-y divide-border">
              {discovered.map((item) => (
                <li
                  key={`${item.address}:${item.network}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20"
                >
                  <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <span className="font-medium text-foreground truncate">
                      {item.chainName ?? "Unnamed"}
                    </span>
                    <span className="font-mono text-sm text-muted-foreground truncate" title={item.address}>
                      {truncateAddress(item.address)}
                    </span>
                    <span className="text-sm text-muted-foreground">{item.network}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddOne(item)}
                    className="shrink-0 inline-flex items-center justify-center rounded-md border border-primary bg-primary/10 p-2 text-primary hover:bg-primary/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[40px] min-w-[40px]"
                    aria-label={`Add ${truncateAddress(item.address)}`}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {importAllOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-all-title"
        >
          <button
            type="button"
            onClick={() => !importing && setImportAllOpen(false)}
            className="absolute inset-0 -z-10"
            aria-label="Close"
          />
          <div
            className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="import-all-title" className="text-lg font-semibold text-foreground mb-4">
              Add all to team
            </h2>
            <div className="mb-4">
              <label htmlFor="import-all-team" className="block text-sm font-medium text-foreground mb-1.5">
                Team
              </label>
              <select
                id="import-all-team"
                value={importTeamId}
                onChange={(e) => setImportTeamId(e.target.value)}
                disabled={importing}
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[44px]"
              >
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.teamName}
                  </option>
                ))}
              </select>
            </div>
            {importResult && (
              <p className="mb-4 text-sm text-muted-foreground">
                {importResult.added} added, {importResult.failed} failed.
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => !importing && setImportAllOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
              >
                {importResult ? "Close" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleImportAll}
                disabled={importing || !importTeamId}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 min-h-[44px]"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                    Adding {discovered.length} safes…
                  </>
                ) : (
                  "Add all"
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => !importing && setImportAllOpen(false)}
              className="absolute top-4 right-4 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
