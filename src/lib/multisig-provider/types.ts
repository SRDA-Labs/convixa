/**
 * Wallet-agnostic multisig types.
 *
 * These normalized types are the contract between Convixa's business logic
 * (policy engine, alerting, dashboard, export) and any multisig implementation
 * (Safe, Zodiac, Roles v2, Hats Signer Gate, custom modules).
 *
 * All providers MUST produce data in these shapes.
 */

/** Supported multisig implementation types. */
export type MultisigImplementation =
  | "safe"
  | "zodiac"
  | "roles_v2"
  | "hats_signer_gate"
  | "custom";

/**
 * A multisig wallet, regardless of implementation.
 * Superset of what Safe API returns — designed to accommodate
 * Zodiac modules, Roles v2 modifiers, and future implementations.
 */
export interface MultisigAccount {
  /** Convixa's internal safe ID (references safes.id). */
  safeId: string;
  /** The contract address (checksummed where possible). */
  address: string;
  /** Network slug (eth, base, arbitrum, etc.). */
  network: string;
  /** Implementation type. */
  implementation: MultisigImplementation;
  /** Implementation version (e.g., "1.4.1" for Safe, "2.0.0" for Roles v2). */
  version?: string;
  /** Current nonce. */
  nonce: number;
  /** Required confirmations. */
  threshold: number;
  /** All signer/owner addresses. */
  signers: string[];
}

/**
 * A pending transaction on any multisig.
 * Normalized from SafeTransaction (Safe API), but also suitable
 * for Zodiac proposals or Roles v2 queued actions.
 */
export interface PendingMultisigTx {
  /** Implementation-specific transaction hash. */
  txHash: string;
  /** Destination address. */
  to: string;
  /** Native value in wei (string to avoid BigInt serialisation issues). */
  value: string;
  /** Calldata (null = empty). */
  data: string | null;
  /** Operation type (0 = Call, 1 = DelegateCall for Safe). */
  operation: number;
  /** Addresses that have confirmed so far. */
  confirmations: string[];
  /** Required confirmations. */
  confirmationsRequired: number;
  /** When the transaction was submitted. */
  submissionDate: string;
  /** Address that proposed the transaction (if known). */
  proposedBy?: string;
  /** Nonce of the transaction. */
  nonce?: number;
}

/** Token balance entry. */
export interface TokenBalance {
  /** Token contract address (null = native asset). */
  tokenAddress: string | null;
  /** Token symbol (e.g., "USDC", "ETH"). */
  symbol: string;
  /** Token name (e.g., "USD Coin"). */
  name: string;
  /** Token decimals. */
  decimals: number;
  /** Raw balance in token base units (wei for native). */
  balance: string;
}

/** What operations a provider can perform. */
export interface ProviderCapabilities {
  fetchInfo: boolean;
  fetchPendingTransactions: boolean;
  fetchBalances: boolean;
  fetchTransactionHistory: boolean;
  discoverBySigner: boolean;
  supportsGuards: boolean;
  supportsModules: boolean;
}
