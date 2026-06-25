// Central place to configure the deployed contract and token addresses.
// After deploying the StellarLend contract (see /contract/README.md),
// fill in CONTRACT_ID below. The defaults point at Stellar's public
// testnet RPC and the testnet USDC issued by Circle's testnet anchor.

export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

// Deploy the contract from /contract and paste its C... address here.
export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ??
  "CCONTRACTIDPLACEHOLDER00000000000000000000000000000";

// Native XLM, represented as a Stellar Asset Contract address on testnet.
export const XLM_SAC =
  process.env.NEXT_PUBLIC_XLM_SAC ??
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// Debt-side token SAC address (e.g. a testnet USDC you issue and wrap as a
// SAC via `stellar contract id asset --network testnet --asset USDC:G...`).
// There is no fixed canonical testnet USDC address — deploy your own and
// set NEXT_PUBLIC_USDC_SAC, or use this placeholder for local development.
export const USDC_SAC =
  process.env.NEXT_PUBLIC_USDC_SAC ??
  "CUSDCSACPLACEHOLDER0000000000000000000000000000000";

export const SCALE = 10_000_000n; // 1e7, matches 7-decimal token amounts
export const BPS = 10_000n;
