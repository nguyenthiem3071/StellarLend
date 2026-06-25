"use client";

import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { HotWalletModule } from "@creit.tech/stellar-wallets-kit/modules/hotwallet";

export const NETWORK_PASSPHRASE = Networks.TESTNET;

let initialized = false;

/**
 * Ensures the wallet kit is initialized exactly once. Safe to call on every
 * render; subsequent calls are no-ops.
 */
export function ensureWalletKit() {
  if (initialized) return;

  StellarWalletsKit.init({
    network: Networks.TESTNET,
    modules: [
      new FreighterModule(),
      new xBullModule(),
      new AlbedoModule(),
      new HotWalletModule(),
    ],
  });

  initialized = true;
}

/** Opens the wallet picker modal and returns the connected address. */
export async function connectWallet(): Promise<string> {
  ensureWalletKit();
  const { address } = await StellarWalletsKit.authModal();
  return address;
}

export async function disconnectWallet(): Promise<void> {
  ensureWalletKit();
  await StellarWalletsKit.disconnect();
}

export async function signXdr(xdr: string, address: string): Promise<string> {
  ensureWalletKit();
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return signedTxXdr;
}
