"use client";

import { useCallback, useEffect, useState } from "react";
import { getPoolConfig, getPoolLiquidity, getUserPosition, PoolConfig, UserPosition } from "@/lib/contract";

export interface PoolData {
  config: PoolConfig | null;
  liquidity: bigint | null;
  position: UserPosition | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePoolData(address: string | null): PoolData {
  const [config, setConfig] = useState<PoolConfig | null>(null);
  const [liquidity, setLiquidity] = useState<bigint | null>(null);
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [cfg, liq] = await Promise.all([getPoolConfig(), getPoolLiquidity()]);
        if (cancelled) return;
        setConfig(cfg);
        setLiquidity(liq);

        if (address) {
          const pos = await getUserPosition(address);
          if (!cancelled) setPosition(pos);
        } else {
          setPosition(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load pool data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [address, nonce]);

  return { config, liquidity, position, loading, error, refresh };
}
