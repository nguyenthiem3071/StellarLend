"use client";

import { useWallet } from "@/hooks/useWallet";
import { usePoolData } from "@/hooks/usePoolData";
import { NavBar } from "@/components/NavBar";
import { PositionCard } from "@/components/PositionCard";
import { ActionPanel } from "@/components/ActionPanel";
import { PoolStats } from "@/components/PoolStats";

export default function Home() {
  const { address, connecting, connect, disconnect } = useWallet();
  const { config, liquidity, position, error, refresh } = usePoolData(address);

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar
        address={address}
        connecting={connecting}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            Soroban · Lending pool
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-0 sm:text-4xl">
            Borrow USDC against your XLM.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-1">
            Deposit XLM as collateral, borrow USDC at a fixed rate, and keep
            an eye on your health factor to avoid liquidation.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-line bg-surface-1 px-4 py-3 text-sm text-ink-1">
            {error.includes("CCONTRACTID") ||
            error.includes("USDCSACPLACEHOLDER") ||
            error.includes("Bad union switch") ||
            error.includes("not found")
              ? "This deployment isn't pointed at a live contract yet. Set NEXT_PUBLIC_CONTRACT_ID to your deployed StellarLend address to see real pool data."
              : error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <PositionCard position={position} config={config} connected={!!address} />
            <ActionPanel address={address} onSubmitted={refresh} />
          </div>
          <PoolStats config={config} liquidity={liquidity} />
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-ink-2">
          StellarLend MVP — runs on Stellar testnet. Health factors and rates
          are illustrative and not financial advice.
        </div>
      </footer>
    </div>
  );
}
