"use client";

import { useCallback, useEffect, useState } from "react";
import { connectWallet, disconnectWallet, ensureWalletKit } from "@/lib/wallet";

const STORAGE_KEY = "stellarlend.address";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    ensureWalletKit();
    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    if (saved) setAddress(saved);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      window.sessionStorage.setItem(STORAGE_KEY, addr);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setAddress(null);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return { address, connecting, connect, disconnect };
}
