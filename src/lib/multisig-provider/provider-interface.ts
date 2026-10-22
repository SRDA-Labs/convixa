/**
 * MultisigProvider — the abstraction contract.
 *
 * Every multisig implementation (Safe, Zodiac, Roles v2, custom modules)
 * implements this interface. Convixa's business logic never calls Safe API
 * directly; it calls the provider resolved from the registry.
 */

import type {
  MultisigAccount,
  PendingMultisigTx,
  TokenBalance,
  ProviderCapabilities,
} from "./types";

export interface MultisigProvider {
  /** Unique identifier for this provider (e.g., "safe", "zodiac"). */
  readonly id: string;

  /** Human-readable name. */
  readonly name: string;

  /** Which networks this provider supports. */
  readonly supportedNetworks: string[];

  /** What operations this provider can perform. */
  readonly capabilities: ProviderCapabilities;

  /**
   * Fetch multisig metadata: threshold, signers, nonce, version.
   * Returns null if the address is not a valid multisig of this type
   * on the given network.
   */
  fetchAccount(
    network: string,
    address: string
  ): Promise<MultisigAccount | null>;

  /** Fetch pending (not-yet-executed) transactions. */
  fetchPendingTransactions(
    network: string,
    address: string
  ): Promise<PendingMultisigTx[]>;

  /** Fetch token balances for the multisig. */
  fetchBalances(network: string, address: string): Promise<TokenBalance[]>;

  /** Fetch executed transaction history. */
  fetchTransactionHistory(
    network: string,
    address: string,
    limit?: number
  ): Promise<PendingMultisigTx[]>;

  /**
   * Discover all multisig addresses where the given EOA is a signer.
   * Returns an array of multisig contract addresses.
   */
  discoverBySigner(
    network: string,
    signerAddress: string
  ): Promise<string[]>;

  /** Get the UI URL for viewing this multisig in its native app. */
  getAppUrl(network: string, address: string): string;

  /** Get the block explorer transaction URL. */
  getExplorerTxUrl(network: string, txHash: string): string;
}
