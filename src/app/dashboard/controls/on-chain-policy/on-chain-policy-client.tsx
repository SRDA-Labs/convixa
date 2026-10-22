"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { encodeFunctionData } from "viem";
import { Loader2, Shield, Download, Copy, Check, Wallet, Info, Rocket, Zap, Eye, X, ChevronLeft } from "lucide-react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useWalletClient, usePublicClient, useSwitchChain } from "wagmi";
import { cn } from "@/lib/cn";
import { SAFE_CHAINS, getSafeAppUrl } from "@/lib/safe-api";
import { deployPolicyGuardWithWallet, type PolicyArtifacts } from "@/lib/on-chain-policy/deploy-with-wallet";
import { POLICY_GUARD_SOURCE } from "@/lib/on-chain-policy/guard-source";
import {
  mainnet,
  base,
  arbitrum,
  polygon,
  optimism,
  gnosis,
  avalanche,
  bsc,
  sepolia,
} from "wagmi/chains";
import type { Chain } from "viem";

const CHAIN_ID_TO_CHAIN: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [base.id]: base,
  [arbitrum.id]: arbitrum,
  [polygon.id]: polygon,
  [optimism.id]: optimism,
  [gnosis.id]: gnosis,
  [avalanche.id]: avalanche,
  [bsc.id]: bsc,
  [sepolia.id]: sepolia,
};

type SafeOption = {
  id: string;
  name: string | null;
  address: string;
  network: string;
};

export type OnChainPolicyConfig = {
  safeId: string;
  safeAddress: string;
  safeName: string | null;
  network: string;
  policyOwnerType: "safe" | "eoa";
  policyOwnerAddress: string;
  modules: {
    blocklist?: { addresses: string[] };
    sanctions?: { enabled: boolean; oracleAddress?: string };
    maxValue?: { maxWei: string };
    timeWindow?: { startUtc: string; endUtc: string };
    allowlist?: { addresses: string[] };
  };
};

const CHAINALYSIS_ORACLE = "0x40C57923924B5c5c5455c48D93317139ADDaC8fb";

/** Safe Transaction Builder batch format (drag-and-drop into Safe UI). */
type SafeTxBuilderTransaction = {
  to: string;
  value: string;
  data: string | null;
  operation: number;
  baseGas: string;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
  safeTxGas: string;
};

type SafeTxBuilderBatch = {
  version: string;
  chainId: string;
  meta: { txBuilderVersion: string };
  transactions: SafeTxBuilderTransaction[];
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Third-party calldata decoder — build trust by letting users verify the setGuard calldata. */
const CALLDATA_DECODER_URL = "https://calldata.swiss-knife.xyz/decoder";

const DRAFT_KEY = "convixa-on-chain-policy-draft";

type DraftState = {
  safeId: string;
  policyOwnerType: "safe" | "eoa";
  policyOwnerEoa: string;
  blocklistEnabled: boolean;
  blocklistAddresses: string;
  sanctionsEnabled: boolean;
  sanctionsOracle: string;
  maxValueEnabled: boolean;
  maxValueEth: string;
  timeWindowEnabled: boolean;
  timeWindowStart: string;
  timeWindowEnd: string;
  allowlistEnabled: boolean;
  allowlistAddresses: string;
  configJson: string | null;
  guardAddress: string;
  currentStep: 1 | 2 | 3;
};

export function OnChainPolicyClient() {
  const [safes, setSafes] = useState<SafeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [safeId, setSafeId] = useState("");
  const [policyOwnerType, setPolicyOwnerType] = useState<"safe" | "eoa">("safe");
  const [policyOwnerEoa, setPolicyOwnerEoa] = useState("");
  const [blocklistEnabled, setBlocklistEnabled] = useState(false);
  const [blocklistAddresses, setBlocklistAddresses] = useState("");
  const [sanctionsEnabled, setSanctionsEnabled] = useState(false);
  const [sanctionsOracle, setSanctionsOracle] = useState(CHAINALYSIS_ORACLE);
  const [maxValueEnabled, setMaxValueEnabled] = useState(false);
  const [maxValueEth, setMaxValueEth] = useState("");
  const [timeWindowEnabled, setTimeWindowEnabled] = useState(false);
  const [timeWindowStart, setTimeWindowStart] = useState("");
  const [timeWindowEnd, setTimeWindowEnd] = useState("");
  const [allowlistEnabled, setAllowlistEnabled] = useState(false);
  const [allowlistAddresses, setAllowlistAddresses] = useState("");
  const [configJson, setConfigJson] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guardAddress, setGuardAddress] = useState("");
  const [deployInProgress, setDeployInProgress] = useState(false);
  const [deployStep, setDeployStep] = useState("");
  const [deployError, setDeployError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [showGuardCodeModal, setShowGuardCodeModal] = useState(false);
  const [guardCodeCopied, setGuardCodeCopied] = useState(false);
  const [showSafeBatchModal, setShowSafeBatchModal] = useState(false);
  const [draftSavedFeedback, setDraftSavedFeedback] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  function getDraftState(): DraftState {
    return {
      safeId,
      policyOwnerType,
      policyOwnerEoa,
      blocklistEnabled,
      blocklistAddresses,
      sanctionsEnabled,
      sanctionsOracle,
      maxValueEnabled,
      maxValueEth,
      timeWindowEnabled,
      timeWindowStart,
      timeWindowEnd,
      allowlistEnabled,
      allowlistAddresses,
      configJson,
      guardAddress,
      currentStep,
    };
  }

  function saveDraft() {
    try {
      const draft = getDraftState();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftSavedFeedback(true);
      setTimeout(() => setDraftSavedFeedback(false), 2000);
    } catch {
      // ignore
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const draft = JSON.parse(raw) as DraftState;
      if (typeof draft.currentStep !== "number" || draft.currentStep < 1 || draft.currentStep > 3) return false;
      setSafeId(draft.safeId ?? "");
      setPolicyOwnerType(draft.policyOwnerType ?? "safe");
      setPolicyOwnerEoa(draft.policyOwnerEoa ?? "");
      setBlocklistEnabled(Boolean(draft.blocklistEnabled));
      setBlocklistAddresses(draft.blocklistAddresses ?? "");
      setSanctionsEnabled(Boolean(draft.sanctionsEnabled));
      setSanctionsOracle(draft.sanctionsOracle ?? CHAINALYSIS_ORACLE);
      setMaxValueEnabled(Boolean(draft.maxValueEnabled));
      setMaxValueEth(draft.maxValueEth ?? "");
      setTimeWindowEnabled(Boolean(draft.timeWindowEnabled));
      setTimeWindowStart(draft.timeWindowStart ?? "");
      setTimeWindowEnd(draft.timeWindowEnd ?? "");
      setAllowlistEnabled(Boolean(draft.allowlistEnabled));
      setAllowlistAddresses(draft.allowlistAddresses ?? "");
      setConfigJson(draft.configJson ?? null);
      setGuardAddress(draft.guardAddress ?? "");
      setCurrentStep(draft.currentStep);
      return true;
    } catch {
      return false;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setConfigJson(null);
    setGuardAddress("");
    setCurrentStep(1);
  }

  const fetchSafes = useCallback(async () => {
    const res = await fetch("/api/safes");
    if (!res.ok) return;
    const data = await res.json();
    const list = (data.safes ?? []).map(
      (s: { id: string; name: string | null; address: string; network: string }) => ({
        id: s.id,
        name: s.name ?? null,
        address: s.address,
        network: s.network,
      })
    );
    setSafes(list);
    if (list.length > 0 && !safeId) setSafeId(list[0].id);
  }, [safeId]);

  useEffect(() => {
    setLoading(true);
    fetchSafes().finally(() => setLoading(false));
  }, [fetchSafes]);

  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (!loading && safes.length > 0 && !draftLoadedRef.current) {
      draftLoadedRef.current = true;
      loadDraft();
    }
  }, [loading, safes.length]);

  const selectedSafe = safes.find((s) => s.id === safeId);
  const ownerAddress =
    policyOwnerType === "safe" && selectedSafe ? selectedSafe.address : policyOwnerEoa;

  function buildConfig(): OnChainPolicyConfig | null {
    if (!selectedSafe || !ownerAddress.trim()) return null;
    const modules: OnChainPolicyConfig["modules"] = {};
    if (blocklistEnabled) {
      const addrs = blocklistAddresses
        .split(/[\n,;\s]+/)
        .map((a) => a.trim().toLowerCase())
        .filter((a) => a.length === 42 && a.startsWith("0x"));
      if (addrs.length) modules.blocklist = { addresses: addrs };
    }
    if (sanctionsEnabled) modules.sanctions = { enabled: true, oracleAddress: sanctionsOracle || undefined };
    if (maxValueEnabled && maxValueEth) {
      try {
        const eth = parseFloat(maxValueEth);
        if (eth > 0) modules.maxValue = { maxWei: BigInt(Math.floor(eth * 1e18)).toString() };
      } catch {
        // ignore
      }
    }
    if (timeWindowEnabled && timeWindowStart && timeWindowEnd) {
      const start = new Date(timeWindowStart).getTime() / 1000;
      const end = new Date(timeWindowEnd).getTime() / 1000;
      if (end >= start) modules.timeWindow = { startUtc: String(Math.floor(start)), endUtc: String(Math.floor(end)) };
    }
    if (allowlistEnabled) {
      const addrs = allowlistAddresses
        .split(/[\n,;\s]+/)
        .map((a) => a.trim().toLowerCase())
        .filter((a) => a.length === 42 && a.startsWith("0x"));
      if (addrs.length) modules.allowlist = { addresses: addrs };
    }
    return {
      safeId: selectedSafe.id,
      safeAddress: selectedSafe.address,
      safeName: selectedSafe.name,
      network: selectedSafe.network,
      policyOwnerType,
      policyOwnerAddress: ownerAddress,
      modules,
    };
  }

  function handlePrepareDeploy() {
    const config = buildConfig();
    if (!config) return;
    setConfigJson(JSON.stringify(config, null, 2));
    setCurrentStep(2);
  }

  function handleCopyConfig() {
    if (!configJson) return;
    navigator.clipboard.writeText(configJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownloadConfig() {
    if (!configJson) return;
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "on-chain-policy-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Build JSON for Safe Transaction Builder (setGuard transaction). Drag-and-drop this into Safe UI. */
  function buildSafeBatchJson(): string | null {
    if (!selectedSafe || !guardAddress.trim()) return null;
    const addr = guardAddress.trim();
    if (addr.length !== 42 || !addr.startsWith("0x")) return null;
    const chain = SAFE_CHAINS.find((c) => c.slug === selectedSafe.network);
    if (!chain) return null;
    const setGuardData = encodeFunctionData({
      abi: [{ name: "setGuard", type: "function", inputs: [{ name: "guard", type: "address" }] }],
      functionName: "setGuard",
      args: [addr as `0x${string}`],
    });
    const batch: SafeTxBuilderBatch = {
      version: "1.0",
      chainId: String(chain.chainId),
      meta: { txBuilderVersion: "1.13.1" },
      transactions: [
        {
          to: selectedSafe.address,
          value: "0",
          data: setGuardData,
          operation: 0,
          baseGas: "0",
          gasPrice: "0",
          gasToken: ZERO_ADDRESS,
          refundReceiver: ZERO_ADDRESS,
          nonce: 0,
          safeTxGas: "0",
        },
      ],
    };
    return JSON.stringify(batch, null, 2);
  }

  function handleDownloadSafeBatch() {
    const json = buildSafeBatchJson();
    if (!json) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "safe-set-guard-batch.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeployWithWallet() {
    const config = buildConfig();
    if (!config || !selectedSafe) return;
    setDeployError(null);
    setDeployInProgress(true);
    setDeployStep("Preparing…");
    try {
      const safeChain = SAFE_CHAINS.find((c) => c.slug === selectedSafe!.network);
      if (!safeChain) {
        setDeployError("Unsupported network for deployment.");
        return;
      }
      const chain = CHAIN_ID_TO_CHAIN[safeChain.chainId];
      if (!chain) {
        setDeployError("Chain not configured in wallet.");
        return;
      }
      if (!walletClient?.account) {
        setDeployError("Connect your wallet first.");
        return;
      }
      if (!publicClient) {
        setDeployError("RPC client not available.");
        return;
      }
      setDeployStep("Switching network…");
      await switchChainAsync?.({ chainId: chain.id });
      setDeployStep("Loading contract artifacts…");
      const res = await fetch("/contracts/policy-guard-artifacts.json");
      if (!res.ok) throw new Error("Failed to load contract artifacts.");
      const artifacts = (await res.json()) as PolicyArtifacts;
      const guardAddr = await deployPolicyGuardWithWallet(
        walletClient,
        publicClient,
        chain,
        config,
        artifacts,
        setDeployStep
      );
      setGuardAddress(guardAddr);
      setDeployStep("");
      setCurrentStep(3);
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : "Deployment failed.");
    } finally {
      setDeployInProgress(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span>Loading safes…</span>
      </div>
    );
  }

  if (safes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-6">
        <p className="text-sm text-muted-foreground">
          Add a Safe to your organization first, then configure an on-chain policy Guard here.
        </p>
      </div>
    );
  }

  const stepDescriptions: Record<1 | 2 | 3, string> = {
    1: "Step 1 of 3: Define your policy. Select your Safe, set the policy owner (who can update rules), and enable the modules you need (blocklist, sanctions, max value, time window, allowlist).",
    2: "Step 2 of 3: Policy Deployment. Download the configuration or use our integrated deployment tools to launch your policy guard on-chain.",
    3: "Step 3 of 3: Finalize Safe Integration. After deploying your policy guard, you must register it with your Safe. We generate a JSON batch file that you can easily upload to Safe's Transaction Builder to enable the on-chain protection.",
  };
  const safeDashboardUrl = selectedSafe ? getSafeAppUrl(selectedSafe.network, selectedSafe.address) : "#";

  return (
    <div className="min-w-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">On-chain policy</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
          {stepDescriptions[currentStep]}
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-4 mb-10">
        <button type="button" onClick={() => setCurrentStep(1)} className="flex items-center gap-2 text-primary font-medium text-sm hover:opacity-90">
          <span className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0",
            currentStep > 1 ? "border-primary bg-primary/10 text-primary" : currentStep === 1 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 text-muted-foreground"
          )}>
            {currentStep > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
          </span>
          <span className="text-foreground">Definition</span>
        </button>
        <span className="flex-1 h-px bg-primary/50 min-w-0" aria-hidden />
        <button type="button" onClick={() => (configJson || currentStep > 2) && setCurrentStep(2)} className={cn("flex items-center gap-2 font-medium text-sm shrink-0", configJson || currentStep > 2 ? "text-primary hover:opacity-90" : "text-muted-foreground cursor-default")}>
          <span className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0",
            currentStep > 2 ? "border-primary bg-primary/10 text-primary" : currentStep === 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 text-muted-foreground"
          )}>
            {currentStep > 2 ? <Check className="h-3.5 w-3.5" /> : "2"}
          </span>
          <span className="text-foreground">Deployment</span>
        </button>
        <span className="flex-1 h-px bg-primary/50 min-w-0" aria-hidden />
        <button type="button" onClick={() => (configJson || currentStep >= 3) && setCurrentStep(3)} className={cn("flex items-center gap-2 font-medium text-sm shrink-0", configJson || currentStep >= 3 ? "text-primary hover:opacity-90" : "text-muted-foreground cursor-default")}>
          <span className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0",
            currentStep === 3 ? "bg-primary text-primary-foreground" : "border border-primary bg-primary/10 text-primary"
          )}>
            3
          </span>
          <span className="text-foreground">Integration</span>
        </button>
      </div>

      {/* Step 1: Definition */}
      {currentStep === 1 && (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border bg-muted/30">
          <h2 className="text-lg font-bold text-foreground">1. Definition</h2>
        </div>
        <form
          className="p-6 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            handlePrepareDeploy();
          }}
        >
        <div>
          <label className="block text-sm font-medium text-foreground">Safe</label>
          <select
            value={safeId}
            onChange={(e) => setSafeId(e.target.value)}
            className="mt-1.5 block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {safes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.address} ({s.network})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Policy owner</label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Who can update the policy (add/remove addresses, change caps, etc.)
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="policyOwner"
                checked={policyOwnerType === "safe"}
                onChange={() => setPolicyOwnerType("safe")}
                className="rounded border-input"
              />
              <span className="text-sm">Safe (multisig)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="policyOwner"
                checked={policyOwnerType === "eoa"}
                onChange={() => setPolicyOwnerType("eoa")}
                className="rounded border-input"
              />
              <span className="text-sm">EOA</span>
            </label>
          </div>
          {policyOwnerType === "eoa" && (
            <input
              type="text"
              placeholder="0x…"
              value={policyOwnerEoa}
              onChange={(e) => setPolicyOwnerEoa(e.target.value)}
              className="mt-2 block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
        </div>

        <div className="space-y-4">
          <span className="block text-sm font-medium text-foreground">Modules</span>

          <label className="flex items-center gap-3 rounded border border-border p-3">
            <input
              type="checkbox"
              checked={blocklistEnabled}
              onChange={(e) => setBlocklistEnabled(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Blocklist — block transactions to these addresses</span>
          </label>
          {blocklistEnabled && (
            <textarea
              placeholder="One address per line or comma-separated (0x…)"
              value={blocklistAddresses}
              onChange={(e) => setBlocklistAddresses(e.target.value)}
              rows={3}
              className="ml-6 block w-full max-w-xl rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}

          <label className="flex items-center gap-3 rounded border border-border p-3">
            <input
              type="checkbox"
              checked={sanctionsEnabled}
              onChange={(e) => setSanctionsEnabled(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Sanctions oracle — block sanctioned addresses</span>
          </label>
          {sanctionsEnabled && (
            <input
              type="text"
              placeholder="Oracle address (default: Chainalysis)"
              value={sanctionsOracle}
              onChange={(e) => setSanctionsOracle(e.target.value)}
              className="ml-6 block w-full max-w-xl rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}

          <label className="flex items-center gap-3 rounded border border-border p-3">
            <input
              type="checkbox"
              checked={maxValueEnabled}
              onChange={(e) => setMaxValueEnabled(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Max native value (ETH) per tx</span>
          </label>
          {maxValueEnabled && (
            <input
              type="text"
              placeholder="e.g. 10"
              value={maxValueEth}
              onChange={(e) => setMaxValueEth(e.target.value)}
              className="ml-6 block w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}

          <label className="flex items-center gap-3 rounded border border-border p-3">
            <input
              type="checkbox"
              checked={timeWindowEnabled}
              onChange={(e) => setTimeWindowEnabled(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Time window (UTC) — only allow txs within this window</span>
          </label>
          {timeWindowEnabled && (
            <div className="ml-6 flex flex-wrap gap-4">
              <input
                type="datetime-local"
                value={timeWindowStart}
                onChange={(e) => setTimeWindowStart(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="datetime-local"
                value={timeWindowEnd}
                onChange={(e) => setTimeWindowEnd(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          <label className="flex items-center gap-3 rounded border border-border p-3">
            <input
              type="checkbox"
              checked={allowlistEnabled}
              onChange={(e) => setAllowlistEnabled(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Allowlist — only allow transactions to these addresses</span>
          </label>
          {allowlistEnabled && (
            <textarea
              placeholder="One address per line or comma-separated (0x…)"
              value={allowlistAddresses}
              onChange={(e) => setAllowlistAddresses(e.target.value)}
              rows={3}
              className="ml-6 block w-full max-w-xl rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground uppercase tracking-tight",
              "hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            )}
          >
            <Shield className="h-4 w-4" aria-hidden />
            Continue to deployment
          </button>
        </div>
        </form>
      </div>
      )}

      {/* Step 2: Deployment - aligned with Execution Options (Direct / Managed) */}
      {currentStep === 2 && configJson && (
        <>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30">
              <h2 className="text-lg font-bold text-foreground">2. Deployment</h2>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-muted-foreground">
                Download this config and run the deploy script, or use our platform tools below to finalize the operation on-chain.
              </p>
              <div className="rounded border border-border bg-muted/50 p-4 font-mono text-[12px] text-muted-foreground leading-relaxed overflow-x-auto max-h-64 overflow-y-auto">
                <pre className="whitespace-pre">{configJson}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyConfig}
                  className="inline-flex items-center gap-2 rounded border border-border bg-muted px-4 py-2 text-xs font-bold text-foreground uppercase tracking-tight hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy config"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadConfig}
                  className="inline-flex items-center gap-2 rounded border border-border bg-muted px-4 py-2 text-xs font-bold text-foreground uppercase tracking-tight hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download config
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Standalone run:{" "}
                <code className="rounded bg-muted px-2 py-0.5 border border-border text-foreground">
                  npm run deploy-policy-guard -- --config on-chain-policy-config.json
                </code>
              </p>

              <div className="pt-8 mt-4 border-t border-border">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-6">
                  Execution Options
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Direct Deploy card */}
                  <div className="rounded border border-border bg-muted/30 p-5 flex flex-col justify-between hover:border-border/80 transition-colors">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-primary" aria-hidden />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Direct Deploy</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Connect your own wallet to sign and broadcast the deployment transaction directly.
                      </p>
                    </div>
                    {deployError && (
                      <p className="text-sm text-destructive mb-3" role="alert">{deployError}</p>
                    )}
                    {deployInProgress && deployStep && (
                      <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {deployStep}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowGuardCodeModal(true)}
                        className="flex-shrink-0 rounded border border-border bg-background p-2.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors"
                        title="View guard code"
                        aria-label="View guard code"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      {!walletClient?.account ? (
                        <button
                          type="button"
                          onClick={() => openConnectModal?.()}
                          className="flex-1 min-w-0 inline-flex items-center justify-center gap-3 rounded border border-primary bg-background px-4 py-3 text-primary text-xs font-bold uppercase tracking-tight hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors"
                        >
                          <Wallet className="h-5 w-5" />
                          Connect Wallet to Deploy
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={deployInProgress}
                          onClick={handleDeployWithWallet}
                          className="flex-1 min-w-0 inline-flex items-center justify-center gap-3 rounded bg-primary px-4 py-3 text-primary-foreground text-xs font-bold uppercase tracking-tight hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                        >
                          <Rocket className="h-5 w-5" />
                          Deploy with {truncateAddress(walletClient.account.address)}
                        </button>
                      )}
                    </div>
                    {showGuardCodeModal && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="guard-code-modal-title"
                        onClick={() => setShowGuardCodeModal(false)}
                      >
                        <div
                          className="bg-card border border-border rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 id="guard-code-modal-title" className="text-lg font-bold text-foreground">
                              PolicyGuard source code
                            </h2>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(POLICY_GUARD_SOURCE);
                                  setGuardCodeCopied(true);
                                  setTimeout(() => setGuardCodeCopied(false), 2000);
                                }}
                                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors"
                                title="Copy code"
                                aria-label="Copy code"
                              >
                                {guardCodeCopied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowGuardCodeModal(false)}
                                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                                aria-label="Close"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                          <div className="p-4 overflow-auto flex-1 min-h-0">
                            <pre className="text-xs font-mono text-foreground whitespace-pre leading-relaxed">
                              <code>{POLICY_GUARD_SOURCE}</code>
                            </pre>
                          </div>
                          <div className="p-4 border-t border-border text-xs text-muted-foreground">
                            This is the Guard contract that will be deployed. It runs your policy modules in{" "}
                            <code className="rounded bg-muted px-1">checkTransaction</code>.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
            <div className="p-4 mx-6 mb-6 rounded-lg bg-muted/30 border border-border flex gap-4">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Security Note:</strong> Your private key is never stored on our servers. When using &quot;Direct Deploy&quot;, transactions are signed locally via your browser provider.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <p className="text-xs text-muted-foreground">
                Need help with deployment?{" "}
                <a href="https://docs.safe.global" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                  View documentation
                </a>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={saveDraft}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {draftSavedFeedback ? "Draft saved" : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-10 text-sm uppercase tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors"
              >
                Continue to Integration
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 3: Safe Integration */}
      {currentStep === 3 && (
        <>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/30">
              <h2 className="text-lg font-bold text-foreground">3. Safe Integration</h2>
            </div>
            <div className="p-6 space-y-8">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-muted border border-border text-[10px] font-bold flex items-center justify-center text-foreground">01</span>
                  <p className="text-sm text-muted-foreground">
                    Paste the <strong className="text-foreground">Guard address</strong> generated from the previous deployment step below. This is the smart contract address that will enforce your policy rules.
                  </p>
                </div>
                <div className="pl-9">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Guard address (after deployment)</label>
                  <input
                    type="text"
                    placeholder="0x0000000000000000000000000000000000000000"
                    value={guardAddress}
                    onChange={(e) => setGuardAddress(e.target.value)}
                    className="w-full rounded border border-input bg-background px-4 py-2.5 text-sm font-mono text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-muted border border-border text-[10px] font-bold flex items-center justify-center text-foreground">02</span>
                  <p className="text-sm text-muted-foreground">
                    Download the <strong className="text-foreground">Safe Batch JSON</strong> file. This file contains the transaction details needed to set the Guard on your Safe multisig.
                  </p>
                </div>
                <div className="pl-9 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSafeBatchModal(true)}
                    disabled={!buildSafeBatchJson()}
                    className="flex-shrink-0 rounded border border-border bg-background p-2.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    title="View Safe batch JSON"
                    aria-label="View Safe batch JSON"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSafeBatch}
                    disabled={!guardAddress.trim() || !buildSafeBatchJson()}
                    className="inline-flex items-center gap-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-6 text-sm uppercase tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Download className="h-5 w-5" />
                    Download Safe Batch JSON
                  </button>
                </div>
                {showSafeBatchModal && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="safe-batch-modal-title"
                    onClick={() => setShowSafeBatchModal(false)}
                  >
                    <div
                      className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between p-4 border-b border-border">
                        <h2 id="safe-batch-modal-title" className="text-lg font-bold text-foreground">
                          Safe Batch JSON
                        </h2>
                        <button
                          type="button"
                          onClick={() => setShowSafeBatchModal(false)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                          aria-label="Close"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="p-4 overflow-auto flex-1 min-h-0">
                        {buildSafeBatchJson() ? (
                          <pre className="text-xs font-mono text-foreground whitespace-pre leading-relaxed">
                            <code>{buildSafeBatchJson()}</code>
                          </pre>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Paste a valid Guard address above to generate the batch JSON preview.
                          </p>
                        )}
                      </div>
                      <div className="p-4 border-t border-border space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Drag and drop this file into Safe&apos;s Transaction Builder to create the setGuard transaction.
                        </p>
                        {(() => {
                          const batchStr = buildSafeBatchJson();
                          const calldata = batchStr
                            ? (JSON.parse(batchStr) as SafeTxBuilderBatch).transactions[0]?.data ?? null
                            : null;
                          const decodeUrl = calldata
                            ? `${CALLDATA_DECODER_URL}?calldata=${encodeURIComponent(calldata)}`
                            : null;
                          return decodeUrl ? (
                            <div>
                              <a
                                href={decodeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-colors"
                              >
                                <Eye className="h-4 w-4" />
                                Decode calldata
                              </a>
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                Verify the transaction calldata with a third-party decoder (opens Swiss-Knife.xyz).
                              </p>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-muted border border-border text-[10px] font-bold flex items-center justify-center text-foreground">03</span>
                  <p className="text-sm text-muted-foreground">
                    Go to your{" "}
                    <a href={safeDashboardUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
                      Safe Dashboard
                    </a>
                    , open the <strong className="text-foreground">Transaction Builder</strong> app, and drag and drop the JSON file you just downloaded.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 mx-6 mb-6 rounded-lg bg-muted/30 border border-border flex gap-4">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Technical Note:</strong> The transaction batch will include a{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-foreground">setGuard(guardAddress)</code> call. Once executed by your Safe owners, all future transactions will be intercepted and validated by the deployed Policy Guard on-chain.
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <p className="text-xs text-muted-foreground">
                Need help with integration?{" "}
                <a href="https://docs.safe.global" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                  View documentation
                </a>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={saveDraft}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {draftSavedFeedback ? "Draft saved" : "Save draft"}
              </button>
              <button
                type="button"
                onClick={clearDraft}
                className="text-sm border border-border bg-background px-4 py-2 rounded font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                Discard changes
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
