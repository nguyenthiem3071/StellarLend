# StellarLend — MVP Lending Pool on Stellar (Soroban)

Over-collateralized lending: deposit XLM, borrow USDC, track your health
factor, repay, withdraw, and (if a position becomes unhealthy) liquidate.
Built for a Stellar MVP hackathon submission.

```
stellarlend/
├── contract/   # Soroban smart contract (Rust)
└── frontend/   # Next.js dashboard (Freighter / wallet connect)
```

## 1. Deploy the contract

You'll need the Rust toolchain + Stellar CLI. These can't be installed in
this sandbox (no network access to rustup/static.rust-lang.org), so run
this part on your own machine.

```bash
# Install prerequisites (once)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli --features opt

# Create / fund a deployer identity on testnet
stellar keys generate --global deployer --network testnet --fund

cd contract
cargo build --target wasm32-unknown-unknown --release
```

### Deploy the contract

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellarlend.wasm \
  --source deployer \
  --network testnet
# -> prints the contract's C... address. Save it.
```

### Get / create the token addresses

XLM's testnet SAC address is fixed:
`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

For the debt token (USDC), issue your own testnet asset and wrap it as a
SAC:

```bash
# Issue a testnet "USDC" from your deployer account (acts as issuer)
stellar contract id asset \
  --network testnet \
  --asset USDC:$(stellar keys address deployer)

# Deploy the SAC for that asset
stellar contract asset deploy \
  --source deployer \
  --network testnet \
  --asset USDC:$(stellar keys address deployer)
# -> prints the USDC SAC address. Save it.
```

### Initialize the pool

```bash
stellar contract invoke \
  --id <STELLARLEND_CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin $(stellar keys address deployer) \
  --collateral_token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --debt_token <USDC_SAC_ADDRESS> \
  --ltv_bps 7500 \
  --liq_threshold_bps 8500 \
  --rate_bps 800 \
  --price_scaled 10000000
```

This sets a 75% max LTV, 85% liquidation threshold, 8% APR borrow rate,
and a 1:1 XLM:USDC price (adjust `price_scaled` for a different ratio,
scaled by 1e7).

### Seed pool liquidity

Borrowers need USDC to borrow. Mint some testnet USDC to the contract:

```bash
stellar contract invoke \
  --id <USDC_SAC_ADDRESS> \
  --source deployer \
  --network testnet \
  -- mint \
  --to <STELLARLEND_CONTRACT_ID> \
  --amount 100000000000   # 10,000 USDC (7 decimals)
```

### Run the contract tests

```bash
cd contract
cargo test
```

## 2. Run the frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_CONTRACT_ID=<STELLARLEND_CONTRACT_ID>
NEXT_PUBLIC_XLM_SAC=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
NEXT_PUBLIC_USDC_SAC=<USDC_SAC_ADDRESS>
```

```bash
npm run dev
```

Open http://localhost:3000, install the [Freighter wallet](https://www.freighter.app/),
switch it to Testnet, fund your account via
[Friendbot](https://lab.stellar.org/account/fund), and connect.

## 3. Try it out

1. **Deposit** some XLM as collateral.
2. **Borrow** USDC, up to 75% of your collateral's value.
3. Watch the **health factor** gauge — it turns amber below 1.5x and red
   below 1.0x.
4. **Repay** to reduce your debt (interest accrues continuously at 8% APR).
5. **Withdraw** collateral, as long as you stay within the max LTV.

## Notes on this MVP

- Price is a fixed ratio set at `initialize` time, not a live oracle. For a
  production version, wire `price_scaled` to an oracle (e.g. Reflector).
- Liquidation has no bonus/discount — the liquidator repays the full debt
  and receives the full collateral. A production version would add a
  liquidation incentive.
- Interest accrues linearly (simple interest), not compounded.
- Google Fonts (Space Grotesk / Inter / JetBrains Mono) are referenced via
  CSS font-family fallbacks rather than `next/font`, since this sandbox
  can't reach fonts.googleapis.com. On Vercel or any environment with
  normal internet access, you can switch back to `next/font/google` for
  self-hosted font optimization — see the commented-out approach in
  `src/app/layout.tsx`'s git history, or just re-add the `next/font/google`
  imports.
