"use client";

import { contract } from "@stellar/stellar-sdk";
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from "./config";
import { signXdr } from "./wallet";

/**
 * The methods exposed by the deployed StellarLend Soroban contract.
 * `contract.Client.from` builds these dynamically from the on-chain
 * contract spec, so we describe the shape here for type safety.
 */
interface StellarLendClient {
  initialize(args: {
    admin: string;
    collateral_token: string;
    debt_token: string;
    ltv_bps: number;
    liq_threshold_bps: number;
    rate_bps: number;
    price_scaled: bigint;
  }): Promise<AssembledTransaction<null>>;

  deposit(args: { user: string; amount: bigint }): Promise<AssembledTransaction<null>>;
  withdraw(args: { user: string; amount: bigint }): Promise<AssembledTransaction<null>>;
  borrow(args: { user: string; amount: bigint }): Promise<AssembledTransaction<null>>;
  repay(args: { user: string; amount: bigint }): Promise<AssembledTransaction<null>>;
  liquidate(args: { liquidator: string; user: string }): Promise<AssembledTransaction<null>>;

  get_collateral(args: { user: string }): Promise<AssembledTransaction<bigint>>;
  get_debt(args: { user: string }): Promise<AssembledTransaction<bigint>>;
  health_factor(args: { user: string }): Promise<AssembledTransaction<bigint>>;
  pool_liquidity(): Promise<AssembledTransaction<bigint>>;
  get_config(): Promise<
    AssembledTransaction<[string, string, bigint, bigint, bigint, bigint]>
  >;
}

/**
 * Builds a contract client bound to the user's wallet for signing.
 * Read-only views can be called without a connected wallet (publicKey
 * omitted), but state-changing calls require an address.
 */
async function getClient(publicKey?: string): Promise<StellarLendClient> {
  const client = await contract.Client.from({
    contractId: CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey,
    signTransaction: publicKey
      ? async (xdr: string) => ({
          signedTxXdr: await signXdr(xdr, publicKey),
          signerAddress: publicKey,
        })
      : undefined,
  });
  return client as unknown as StellarLendClient;
}

export interface PoolConfig {
  collateralToken: string;
  debtToken: string;
  ltvBps: bigint;
  liqThresholdBps: bigint;
  rateBps: bigint;
  priceScaled: bigint;
}

export interface UserPosition {
  collateral: bigint;
  debt: bigint;
  healthFactorBps: bigint | null; // null => no debt (infinitely healthy)
}

// i128::MAX, used by the contract as a sentinel for "no debt".
const I128_MAX = (1n << 127n) - 1n;

/** Reads the pool's static configuration (tokens, LTV, rate, price). */
export async function getPoolConfig(): Promise<PoolConfig> {
  const client = await getClient();
  const tx = await client.get_config();
  const [collateralToken, debtToken, ltvBps, liqThresholdBps, rateBps, priceScaled] =
    tx.result;
  return { collateralToken, debtToken, ltvBps, liqThresholdBps, rateBps, priceScaled };
}

/** Reads the pool's available USDC (debt token) liquidity. */
export async function getPoolLiquidity(): Promise<bigint> {
  const client = await getClient();
  const tx = await client.pool_liquidity();
  return tx.result;
}

/** Reads a user's collateral, debt (with accrued interest), and health factor. */
export async function getUserPosition(address: string): Promise<UserPosition> {
  const client = await getClient();

  const [collateralTx, debtTx, healthTx] = await Promise.all([
    client.get_collateral({ user: address }),
    client.get_debt({ user: address }),
    client.health_factor({ user: address }),
  ]);

  const health = healthTx.result;

  return {
    collateral: collateralTx.result,
    debt: debtTx.result,
    healthFactorBps: health === I128_MAX ? null : health,
  };
}

type WriteMethod = "deposit" | "withdraw" | "borrow" | "repay";

/**
 * Calls a state-changing pool method (deposit / withdraw / borrow / repay)
 * for the connected user, simulating, signing via the wallet, and
 * submitting the transaction.
 */
export async function callPoolAction(
  method: WriteMethod,
  address: string,
  amount: bigint,
): Promise<string> {
  const client = await getClient(address);

  const tx = await client[method]({ user: address, amount });
  const sent = await tx.signAndSend();
  return sent.sendTransactionResponse?.hash ?? "submitted";
}

/** Liquidates an unhealthy position, paid for by `liquidator`. */
export async function callLiquidate(liquidator: string, user: string): Promise<string> {
  const client = await getClient(liquidator);
  const tx = await client.liquidate({ liquidator, user });
  const sent = await tx.signAndSend();
  return sent.sendTransactionResponse?.hash ?? "submitted";
}
