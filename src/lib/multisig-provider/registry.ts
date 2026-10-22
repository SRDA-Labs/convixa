/**
 * Provider Registry — resolves which MultisigProvider handles a given Safe.
 *
 * Providers are registered at import time. The registry maps a
 * MultisigImplementation string to a provider instance.
 *
 * Usage:
 *   const provider = getProviderFor("safe", "eth");
 *   const account = await provider.fetchAccount("eth", "0x...");
 */

import type { MultisigProvider } from "./provider-interface";
import type { MultisigImplementation } from "./types";

const providers = new Map<string, MultisigProvider>();

/** Register a provider. Called once per provider at import time. */
export function registerProvider(provider: MultisigProvider): void {
  providers.set(provider.id, provider);
}

/**
 * Resolve the provider for a given implementation and network.
 * Throws if no provider is registered for the implementation.
 */
export function getProviderFor(
  implementation: MultisigImplementation,
  _network: string
): MultisigProvider {
  const provider = providers.get(implementation);
  if (!provider) {
    throw new Error(
      `No provider registered for implementation "${implementation}". ` +
        `Available providers: ${Array.from(providers.keys()).join(", ") || "none"}`
    );
  }
  return provider;
}

/** Get a provider by its id. Returns undefined if not registered. */
export function getProviderById(id: string): MultisigProvider | undefined {
  return providers.get(id);
}

/** List all registered providers. */
export function listProviders(): MultisigProvider[] {
  return Array.from(providers.values());
}

/** Check whether a provider is registered for the given implementation. */
export function hasProvider(implementation: string): boolean {
  return providers.has(implementation);
}
