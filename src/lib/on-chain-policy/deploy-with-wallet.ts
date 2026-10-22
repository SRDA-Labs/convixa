/**
 * Deploy PolicyGuard and modules from the user's connected wallet (in-app deploy).
 * Used by the on-chain policy page when user clicks "Deploy with my wallet".
 */

import type { WalletClient, PublicClient } from "viem";
import type { Chain } from "viem/chains";
import { parseAbi } from "viem";
import type { OnChainPolicyConfig } from "./types";

const CHAINALYSIS_ORACLE = "0x40C57923924B5c5c5455c48D93317139ADDaC8fb";

export type PolicyArtifacts = Record<
  string,
  { abi: unknown[]; bytecode: string }
>;

export async function deployPolicyGuardWithWallet(
  walletClient: WalletClient,
  publicClient: PublicClient,
  chain: Chain,
  config: OnChainPolicyConfig,
  artifacts: PolicyArtifacts,
  onStep?: (step: string) => void
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new Error("Wallet not connected");
  const deployer = account.address;
  const finalOwner = config.policyOwnerAddress as `0x${string}`;
  if (!finalOwner || finalOwner.length !== 42) throw new Error("Invalid policy owner address");

  const getArtifact = (name: string) => {
    const a = artifacts[name];
    if (!a) throw new Error(`Missing artifact: ${name}`);
    return a;
  };

  onStep?.("Deploying PolicyGuard…");
  const guardArtifact = getArtifact("PolicyGuard");
  const guardHash = await walletClient.deployContract({
    account,
    chain,
    abi: guardArtifact.abi,
    bytecode: guardArtifact.bytecode as `0x${string}`,
    args: [deployer],
  });
  const guardReceipt = await publicClient.waitForTransactionReceipt({ hash: guardHash });
  const guardAddress = guardReceipt.contractAddress;
  if (!guardAddress) throw new Error("PolicyGuard deployment failed");

  const moduleAddresses: `0x${string}`[] = [];

  if (config.modules.blocklist?.addresses?.length) {
    onStep?.("Deploying BlocklistPolicyModule…");
    const art = getArtifact("BlocklistPolicyModule");
    const hash = await walletClient.deployContract({
      account,
      chain,
      abi: art.abi,
      bytecode: art.bytecode as `0x${string}`,
      args: [deployer],
    });
    const rec = await publicClient.waitForTransactionReceipt({ hash });
    const addr = rec.contractAddress;
    if (!addr) throw new Error("BlocklistPolicyModule deploy failed");
    moduleAddresses.push(addr);
    const addAbi = parseAbi(["function addToBlocklist(address _addr)"]);
    for (const a of config.modules.blocklist.addresses) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(a)) continue;
      onStep?.(`Adding ${a.slice(0, 10)}… to blocklist`);
      const h = await walletClient.writeContract({
        account,
        chain,
        address: addr,
        abi: addAbi,
        functionName: "addToBlocklist",
        args: [a as `0x${string}`],
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
    }
  }

  if (config.modules.sanctions?.enabled) {
    onStep?.("Deploying SanctionsOraclePolicyModule…");
    const oracle = (config.modules.sanctions.oracleAddress || CHAINALYSIS_ORACLE) as `0x${string}`;
    const art = getArtifact("SanctionsOraclePolicyModule");
    const hash = await walletClient.deployContract({
      account,
      chain,
      abi: art.abi,
      bytecode: art.bytecode as `0x${string}`,
      args: [deployer, oracle],
    });
    const rec = await publicClient.waitForTransactionReceipt({ hash });
    const addr = rec.contractAddress;
    if (!addr) throw new Error("SanctionsOraclePolicyModule deploy failed");
    moduleAddresses.push(addr);
  }

  if (config.modules.maxValue?.maxWei) {
    onStep?.("Deploying MaxValuePolicyModule…");
    const art = getArtifact("MaxValuePolicyModule");
    const hash = await walletClient.deployContract({
      account,
      chain,
      abi: art.abi,
      bytecode: art.bytecode as `0x${string}`,
      args: [deployer, BigInt(config.modules.maxValue.maxWei)],
    });
    const rec = await publicClient.waitForTransactionReceipt({ hash });
    const addr = rec.contractAddress;
    if (!addr) throw new Error("MaxValuePolicyModule deploy failed");
    moduleAddresses.push(addr);
  }

  if (config.modules.timeWindow?.startUtc && config.modules.timeWindow?.endUtc) {
    onStep?.("Deploying TimeWindowPolicyModule…");
    const art = getArtifact("TimeWindowPolicyModule");
    const hash = await walletClient.deployContract({
      account,
      chain,
      abi: art.abi,
      bytecode: art.bytecode as `0x${string}`,
      args: [
        deployer,
        BigInt(config.modules.timeWindow.startUtc),
        BigInt(config.modules.timeWindow.endUtc),
      ],
    });
    const rec = await publicClient.waitForTransactionReceipt({ hash });
    const addr = rec.contractAddress;
    if (!addr) throw new Error("TimeWindowPolicyModule deploy failed");
    moduleAddresses.push(addr);
  }

  if (config.modules.allowlist?.addresses?.length) {
    onStep?.("Deploying AllowlistPolicyModule…");
    const art = getArtifact("AllowlistPolicyModule");
    const hash = await walletClient.deployContract({
      account,
      chain,
      abi: art.abi,
      bytecode: art.bytecode as `0x${string}`,
      args: [deployer],
    });
    const rec = await publicClient.waitForTransactionReceipt({ hash });
    const addr = rec.contractAddress;
    if (!addr) throw new Error("AllowlistPolicyModule deploy failed");
    moduleAddresses.push(addr);
    const addAbi = parseAbi(["function addToAllowlist(address _addr)"]);
    for (const a of config.modules.allowlist.addresses) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(a)) continue;
      onStep?.(`Adding ${a.slice(0, 10)}… to allowlist`);
      const h = await walletClient.writeContract({
        account,
        chain,
        address: addr,
        abi: addAbi,
        functionName: "addToAllowlist",
        args: [a as `0x${string}`],
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
    }
  }

  if (moduleAddresses.length > 0) {
    onStep?.("Registering modules on PolicyGuard…");
    const setModulesAbi = parseAbi(["function setModules(address[] _modules)"]);
    const h = await walletClient.writeContract({
      account,
      chain,
      address: guardAddress,
      abi: setModulesAbi,
      functionName: "setModules",
      args: [moduleAddresses],
    });
    await publicClient.waitForTransactionReceipt({ hash: h });
  }

  onStep?.("Transferring ownership…");
  const setOwnerAbi = parseAbi(["function setOwner(address _newOwner)"]);
  let ownerHash = await walletClient.writeContract({
    account,
    chain,
    address: guardAddress,
    abi: setOwnerAbi,
    functionName: "setOwner",
    args: [finalOwner],
  });
  await publicClient.waitForTransactionReceipt({ hash: ownerHash });
  for (const modAddr of moduleAddresses) {
    ownerHash = await walletClient.writeContract({
      account,
      chain,
      address: modAddr,
      abi: setOwnerAbi,
      functionName: "setOwner",
      args: [finalOwner],
    });
    await publicClient.waitForTransactionReceipt({ hash: ownerHash });
  }

  return guardAddress;
}
