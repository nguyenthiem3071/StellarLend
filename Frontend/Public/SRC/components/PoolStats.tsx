"use client";

import { formatAmount, formatBps, shortenAddress } from "@/lib/format";
import type { PoolConfig } from "@/lib/contract";

interface PoolStatsProps {
  config: PoolConfig | null;
  liquidity: bigint | null;
}

export function PoolStats({ config, liquidity }: PoolStatsProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-6">
      <h2 className="font-display text-base font-semibold text-ink-0">Pool</h2>
      <dl className="mt-4 space-y-3">
        <Row label="Available liquidity (USDC)" value={liquidity != null ? formatAmount(liquidity) : "—"} />
        <Row label="Max LTV" value={config ? formatBps(config.ltvBps) : "—"} />
        <Row label="Liquidation threshold" value={config ? formatBps(config.liqThresholdBps) : "—"} />
        <Row label="Borrow APR" value={config ? formatBps(config.rateBps) : "—"} />
        <Row
          label="Collateral token"
          value={config ? shortenAddress(config.collateralToken, 6) : "—"}
          mono
        />
        <Row
          label="Debt token"
          value={config ? shortenAddress(config.debtToken, 6) : "—"}
          mono
        />
      </dl>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-ink-1">{label}</dt>
      <dd className={`text-sm text-ink-0 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
