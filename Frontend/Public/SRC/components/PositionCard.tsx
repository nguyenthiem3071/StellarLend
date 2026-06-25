"use client";

import { HealthGauge } from "./HealthGauge";
import { formatAmount, formatBps } from "@/lib/format";
import type { PoolConfig, UserPosition } from "@/lib/contract";

interface PositionCardProps {
  position: UserPosition | null;
  config: PoolConfig | null;
  connected: boolean;
}

export function PositionCard({ position, config, connected }: PositionCardProps) {
  const ratio =
    position?.healthFactorBps != null ? Number(position.healthFactorBps) / 10000 : null;

  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink-0">
          Your position
        </h2>
        {config && (
          <span className="font-mono text-xs text-ink-2">
            Max LTV {formatBps(config.ltvBps)}
          </span>
        )}
      </div>

      {!connected ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-10 text-center">
          <p className="font-display text-lg text-ink-0">No wallet connected</p>
          <p className="max-w-xs text-sm text-ink-2">
            Connect a Stellar wallet to deposit XLM, borrow USDC, and watch
            your health factor update live.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-around">
          <HealthGauge ratio={ratio} />
          <dl className="w-full max-w-xs space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <dt className="text-sm text-ink-1">Collateral (XLM)</dt>
              <dd className="font-mono text-sm text-ink-0">
                {position ? formatAmount(position.collateral) : "0.00"}
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <dt className="text-sm text-ink-1">Debt (USDC)</dt>
              <dd className="font-mono text-sm text-ink-0">
                {position ? formatAmount(position.debt) : "0.00"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-ink-1">Borrow rate</dt>
              <dd className="font-mono text-sm text-ink-0">
                {config ? formatBps(config.rateBps) : "—"}
                <span className="text-ink-2"> APR</span>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
