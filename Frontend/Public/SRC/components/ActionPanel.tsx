"use client";

import { useState } from "react";
import { callPoolAction } from "@/lib/contract";
import { toUnits } from "@/lib/format";

type Action = "deposit" | "withdraw" | "borrow" | "repay";

const TABS: { id: Action; label: string; asset: string; hint: string }[] = [
  {
    id: "deposit",
    label: "Deposit",
    asset: "XLM",
    hint: "Add XLM as collateral to increase your borrowing power.",
  },
  {
    id: "borrow",
    label: "Borrow",
    asset: "USDC",
    hint: "Borrow USDC against your deposited XLM, up to the pool's max LTV.",
  },
  {
    id: "repay",
    label: "Repay",
    asset: "USDC",
    hint: "Repay outstanding USDC debt, including accrued interest.",
  },
  {
    id: "withdraw",
    label: "Withdraw",
    asset: "XLM",
    hint: "Withdraw XLM collateral, as long as your position stays within the max LTV.",
  },
];

interface ActionPanelProps {
  address: string | null;
  onSubmitted: () => void;
}

export function ActionPanel({ address, onSubmitted }: ActionPanelProps) {
  const [active, setActive] = useState<Action>("deposit");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "pending" | "success" | "error"; message?: string }>({
    kind: "idle",
  });

  const tab = TABS.find((t) => t.id === active)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;

    const units = toUnits(amount);
    if (units <= 0n) {
      setStatus({ kind: "error", message: "Enter an amount greater than 0." });
      return;
    }

    setStatus({ kind: "pending" });
    try {
      const hash = await callPoolAction(active, address, units);
      setStatus({ kind: "success", message: `Submitted: ${hash}` });
      setAmount("");
      onSubmitted();
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Transaction failed.",
      });
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-6">
      <div className="flex gap-1 rounded-full bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActive(t.id);
              setStatus({ kind: "idle" });
            }}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              active === t.id
                ? "bg-accent text-surface-0"
                : "text-ink-1 hover:text-ink-0"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink-1">{tab.hint}</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={!address}
            className="w-full rounded-xl border border-line bg-surface-0 px-4 py-3 pr-20 font-mono text-lg text-ink-0 placeholder:text-ink-2 focus:border-accent disabled:opacity-50"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm text-ink-2">
            {tab.asset}
          </span>
        </div>

        <button
          type="submit"
          disabled={!address || status.kind === "pending"}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-surface-0 transition-opacity hover:opacity-90 disabled:bg-surface-2 disabled:text-ink-2"
        >
          {!address
            ? "Connect wallet to continue"
            : status.kind === "pending"
              ? "Confirm in wallet…"
              : `${tab.label} ${tab.asset}`}
        </button>

        {status.kind === "success" && (
          <p className="break-all font-mono text-xs text-accent">{status.message}</p>
        )}
        {status.kind === "error" && (
          <p className="text-sm text-danger">{status.message}</p>
        )}
      </form>
    </div>
  );
}
