/**
 * Multisig Provider Abstraction Layer
 *
 * Public API — import from here:
 *
 *   import { getProviderFor, MultisigProvider } from "@/lib/multisig-provider";
 */

export type {
  MultisigImplementation,
  MultisigAccount,
  PendingMultisigTx,
  TokenBalance,
  ProviderCapabilities,
} from "./types";

export type { MultisigProvider } from "./provider-interface";

export {
  registerProvider,
  getProviderFor,
  getProviderById,
  listProviders,
  hasProvider,
} from "./registry";

// Side-effect: register the Safe provider so it's always available.
// This import ensures the Safe provider is registered before any code
// calls getProviderFor("safe", ...).
import "./providers/safe-provider";
