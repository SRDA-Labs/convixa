"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Catches runtime errors from WalletConnect/wagmi (e.g. "Connection interrupted while trying to subscribe")
 * when NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing or the WebSocket drops, so the app shows a
 * friendly message instead of a stack trace.
 */
export class WalletErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 bg-background text-foreground rounded-lg border border-border">
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            Connection interrupted. This can happen when the wallet connection is unavailable. Refresh the page to try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
          >
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
