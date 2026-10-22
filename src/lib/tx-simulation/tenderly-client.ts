export type SimulationResult = {
  status: "success" | "failed" | "skipped";
  balanceChanges: Array<{ token: string; delta: string; direction: "in" | "out" }>;
  decodedCall: string | null;
  gasEstimate: string | null;
  riskFlags: Array<{ severity: string; message: string }>;
  raw?: unknown;
};

export function isTenderlyConfigured(): boolean {
  return Boolean(
    process.env.TENDERLY_ACCESS_KEY?.trim() &&
      process.env.TENDERLY_ACCOUNT_SLUG?.trim() &&
      process.env.TENDERLY_PROJECT_SLUG?.trim()
  );
}

export async function simulateWithTenderly(params: {
  network: string;
  from: string;
  to: string;
  data?: string;
  value?: string;
}): Promise<SimulationResult> {
  if (!isTenderlyConfigured()) {
    return {
      status: "skipped",
      balanceChanges: [],
      decodedCall: null,
      gasEstimate: null,
      riskFlags: [
        {
          severity: "info",
          message: "Tenderly not configured — set TENDERLY_* env vars",
        },
      ],
    };
  }

  const account = process.env.TENDERLY_ACCOUNT_SLUG!;
  const project = process.env.TENDERLY_PROJECT_SLUG!;
  const accessKey = process.env.TENDERLY_ACCESS_KEY!;

  const chainMap: Record<string, string> = {
    eth: "1",
    ethereum: "1",
    sepolia: "11155111",
    base: "8453",
    arbitrum: "42161",
    polygon: "137",
    optimism: "10",
  };
  const networkId = chainMap[params.network.toLowerCase()] ?? "1";

  try {
    const url = `https://api.tenderly.co/api/v1/account/${account}/project/${project}/simulate`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": accessKey,
      },
      body: JSON.stringify({
        network_id: networkId,
        from: params.from,
        to: params.to,
        input: params.data ?? "0x",
        value: params.value ?? "0",
        save: false,
        simulation_type: "quick",
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        status: "failed",
        balanceChanges: [],
        decodedCall: null,
        gasEstimate: null,
        riskFlags: [{ severity: "warn", message: `Simulation failed: ${text.slice(0, 120)}` }],
      };
    }

    const data = (await res.json()) as {
      transaction?: { gas_used?: number };
      simulation?: { status?: boolean };
    };

    return {
      status: "success",
      balanceChanges: [],
      decodedCall: `Call to ${params.to.slice(0, 10)}…`,
      gasEstimate: data.transaction?.gas_used?.toString() ?? null,
      riskFlags: [],
      raw: data,
    };
  } catch (e) {
    return {
      status: "failed",
      balanceChanges: [],
      decodedCall: null,
      gasEstimate: null,
      riskFlags: [
        {
          severity: "warn",
          message: e instanceof Error ? e.message : "Simulation error",
        },
      ],
    };
  }
}
