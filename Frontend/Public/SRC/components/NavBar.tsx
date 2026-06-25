"use client";

import { shortenAddress } from "@/lib/format";

interface NavBarProps {
  address: string | null;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function NavBar({ address, connecting, onConnect, onDisconnect }: NavBarProps) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-accent" aria-hidden />
          <span className="font-display text-lg font-semibold tracking-tight">
            StellarLend
          </span>
          <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs font-mono text-ink-2">
            Testnet
          </span>
        </div>

        {address ? (
          <button
            onClick={onDisconnect}
            className="rounded-full border border-line bg-surface-1 px-4 py-2 text-sm font-mono text-ink-0 transition-colors hover:border-accent/40 hover:text-accent"
          >
            {shortenAddress(address)}
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-surface-0 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
