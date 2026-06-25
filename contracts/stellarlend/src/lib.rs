//! StellarLend — minimal over-collateralized lending pool.
//!
//! Model (simplified for MVP):
//! - Users deposit a collateral token (e.g. native XLM, represented as a SAC token).
//! - Users borrow a debt token (e.g. USDC SAC) up to a configured LTV of their
//!   collateral value.
//! - Both tokens are assumed to be 1:1 with a common unit of account for
//!   simplicity (price is supplied at init time as a fixed ratio; in a real
//!   deployment this would come from an oracle).
//! - Interest accrues linearly on the borrowed amount based on a fixed
//!   per-second rate set at initialization.
//!
//! This contract is intentionally compact: it demonstrates deposit, borrow,
//! repay, withdraw, liquidation and health-factor accounting using real
//! token transfers via the Token client (works with any SAC, including the
//! native XLM SAC and a testnet USDC SAC).

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, token, Address, Env, Symbol,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    CollateralToken,
    DebtToken,
    // LTV expressed in basis points (e.g. 7500 = 75%)
    LtvBps,
    // Liquidation threshold in basis points (e.g. 8500 = 85%)
    LiqThresholdBps,
    // Annual interest rate in basis points (e.g. 800 = 8%)
    RateBps,
    // Price of collateral token in units of debt token, scaled by 1e7
    // (matches Stellar's 7-decimal convention). E.g. if 1 collateral = 1 debt,
    // price = 10_000_000.
    PriceScaled,
    // Per-user collateral balance
    Collateral(Address),
    // Per-user principal debt (not including accrued interest)
    Principal(Address),
    // Timestamp of last interest accrual for a user
    LastAccrued(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    InsufficientCollateral = 4,
    InsufficientLiquidity = 5,
    BorrowExceedsLtv = 6,
    RepayExceedsDebt = 7,
    NothingToLiquidate = 8,
    PositionHealthy = 9,
    ZeroAmount = 10,
}

const SCALE: i128 = 10_000_000; // 1e7, matches 7-decimal token amounts
const BPS: i128 = 10_000;
const SECONDS_PER_YEAR: i128 = 365 * 24 * 60 * 60;

#[contract]
pub struct StellarLend;

#[contractimpl]
impl StellarLend {
    /// One-time setup. `price_scaled` is the price of 1 unit of collateral
    /// expressed in units of debt token, scaled by 1e7 (e.g. 10_000_000
    /// means 1:1).
    pub fn initialize(
        env: Env,
        admin: Address,
        collateral_token: Address,
        debt_token: Address,
        ltv_bps: u32,
        liq_threshold_bps: u32,
        rate_bps: u32,
        price_scaled: i128,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CollateralToken, &collateral_token);
        env.storage().instance().set(&DataKey::DebtToken, &debt_token);
        env.storage()
            .instance()
            .set(&DataKey::LtvBps, &(ltv_bps as i128));
        env.storage()
            .instance()
            .set(&DataKey::LiqThresholdBps, &(liq_threshold_bps as i128));
        env.storage()
            .instance()
            .set(&DataKey::RateBps, &(rate_bps as i128));
        env.storage()
            .instance()
            .set(&DataKey::PriceScaled, &price_scaled);

        Ok(())
    }

    /// Deposit collateral token into the pool on behalf of `user`.
    pub fn deposit(env: Env, user: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::ZeroAmount);
        }
        user.require_auth();

        let collateral_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::CollateralToken)
            .ok_or(Error::NotInitialized)?;

        let client = token::Client::new(&env, &collateral_token);
        client.transfer(&user, &env.current_contract_address(), &amount);

        let key = DataKey::Collateral(user.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + amount));

        env.events()
            .publish((Symbol::new(&env, "deposit"), user), amount);
        Ok(())
    }

    /// Withdraw collateral, as long as the position remains within LTV.
    pub fn withdraw(env: Env, user: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::ZeroAmount);
        }
        user.require_auth();

        Self::accrue(&env, &user)?;

        let col_key = DataKey::Collateral(user.clone());
        let collateral: i128 = env.storage().persistent().get(&col_key).unwrap_or(0);
        if collateral < amount {
            return Err(Error::InsufficientCollateral);
        }
        let new_collateral = collateral - amount;

        let debt = Self::current_debt(&env, &user);
        let ltv_bps: i128 = env.storage().instance().get(&DataKey::LtvBps).unwrap();
        let price: i128 = env.storage().instance().get(&DataKey::PriceScaled).unwrap();

        let max_debt = new_collateral * price / SCALE * ltv_bps / BPS;
        if debt > max_debt {
            return Err(Error::BorrowExceedsLtv);
        }

        env.storage().persistent().set(&col_key, &new_collateral);

        let collateral_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::CollateralToken)
            .unwrap();
        let client = token::Client::new(&env, &collateral_token);
        client.transfer(&env.current_contract_address(), &user, &amount);

        env.events()
            .publish((Symbol::new(&env, "withdraw"), user), amount);
        Ok(())
    }

    /// Borrow debt token against deposited collateral.
    pub fn borrow(env: Env, user: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::ZeroAmount);
        }
        user.require_auth();

        Self::accrue(&env, &user)?;

        let collateral: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Collateral(user.clone()))
            .unwrap_or(0);
        let debt = Self::current_debt(&env, &user);

        let ltv_bps: i128 = env.storage().instance().get(&DataKey::LtvBps).unwrap();
        let price: i128 = env.storage().instance().get(&DataKey::PriceScaled).unwrap();

        let max_debt = collateral * price / SCALE * ltv_bps / BPS;
        let new_debt = debt + amount;
        if new_debt > max_debt {
            return Err(Error::BorrowExceedsLtv);
        }

        let debt_token: Address = env.storage().instance().get(&DataKey::DebtToken).unwrap();
        let client = token::Client::new(&env, &debt_token);
        let pool_balance = client.balance(&env.current_contract_address());
        if pool_balance < amount {
            return Err(Error::InsufficientLiquidity);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Principal(user.clone()), &new_debt);
        env.storage()
            .persistent()
            .set(&DataKey::LastAccrued(user.clone()), &env.ledger().timestamp());

        client.transfer(&env.current_contract_address(), &user, &amount);

        env.events()
            .publish((Symbol::new(&env, "borrow"), user), amount);
        Ok(())
    }

    /// Repay borrowed debt token. `amount` may exceed the outstanding debt;
    /// only the owed amount will be pulled.
    pub fn repay(env: Env, user: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::ZeroAmount);
        }
        user.require_auth();

        Self::accrue(&env, &user)?;

        let debt = Self::current_debt(&env, &user);
        if debt == 0 {
            return Err(Error::RepayExceedsDebt);
        }

        let pay = if amount > debt { debt } else { amount };

        let debt_token: Address = env.storage().instance().get(&DataKey::DebtToken).unwrap();
        let client = token::Client::new(&env, &debt_token);
        client.transfer(&user, &env.current_contract_address(), &pay);

        let remaining = debt - pay;
        env.storage()
            .persistent()
            .set(&DataKey::Principal(user.clone()), &remaining);
        env.storage()
            .persistent()
            .set(&DataKey::LastAccrued(user.clone()), &env.ledger().timestamp());

        env.events()
            .publish((Symbol::new(&env, "repay"), user), pay);
        Ok(())
    }

    /// Liquidate an unhealthy position. Anyone can call this. The liquidator
    /// repays the full outstanding debt and receives the user's entire
    /// collateral in return (simplified, no bonus/discount modeling).
    pub fn liquidate(env: Env, liquidator: Address, user: Address) -> Result<(), Error> {
        liquidator.require_auth();

        Self::accrue(&env, &user)?;

        let health = Self::health_factor_bps(&env, &user);
        let liq_threshold_bps: i128 = env
            .storage()
            .instance()
            .get(&DataKey::LiqThresholdBps)
            .unwrap();

        // health_factor_bps is collateral_value / debt_value * 10000.
        // Position is liquidatable if health < liq_threshold (i.e. below
        // the safety margin defined by liq_threshold_bps relative to 100%).
        if health >= liq_threshold_bps || health == i128::MAX {
            return Err(Error::PositionHealthy);
        }

        let debt = Self::current_debt(&env, &user);
        let collateral: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Collateral(user.clone()))
            .unwrap_or(0);

        if debt == 0 || collateral == 0 {
            return Err(Error::NothingToLiquidate);
        }

        let debt_token: Address = env.storage().instance().get(&DataKey::DebtToken).unwrap();
        let collateral_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::CollateralToken)
            .unwrap();

        let debt_client = token::Client::new(&env, &debt_token);
        debt_client.transfer(&liquidator, &env.current_contract_address(), &debt);

        let col_client = token::Client::new(&env, &collateral_token);
        col_client.transfer(&env.current_contract_address(), &liquidator, &collateral);

        env.storage()
            .persistent()
            .set(&DataKey::Principal(user.clone()), &0i128);
        env.storage()
            .persistent()
            .set(&DataKey::Collateral(user.clone()), &0i128);

        env.events()
            .publish((Symbol::new(&env, "liquidate"), user), liquidator);
        Ok(())
    }

    // ---- Views ----

    pub fn get_collateral(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Collateral(user))
            .unwrap_or(0)
    }

    /// Returns the user's debt including accrued interest up to now,
    /// without writing state (read-only simulation of accrual).
    pub fn get_debt(env: Env, user: Address) -> i128 {
        Self::current_debt(&env, &user)
    }

    /// Health factor expressed in basis points: collateral_value * 10000 /
    /// debt_value. Returns i128::MAX if debt is zero (infinitely healthy).
    pub fn health_factor(env: Env, user: Address) -> i128 {
        Self::health_factor_bps(&env, &user)
    }

    pub fn get_config(env: Env) -> (Address, Address, i128, i128, i128, i128) {
        let collateral_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::CollateralToken)
            .unwrap();
        let debt_token: Address = env.storage().instance().get(&DataKey::DebtToken).unwrap();
        let ltv_bps: i128 = env.storage().instance().get(&DataKey::LtvBps).unwrap();
        let liq_threshold_bps: i128 = env
            .storage()
            .instance()
            .get(&DataKey::LiqThresholdBps)
            .unwrap();
        let rate_bps: i128 = env.storage().instance().get(&DataKey::RateBps).unwrap();
        let price: i128 = env.storage().instance().get(&DataKey::PriceScaled).unwrap();
        (
            collateral_token,
            debt_token,
            ltv_bps,
            liq_threshold_bps,
            rate_bps,
            price,
        )
    }

    pub fn pool_liquidity(env: Env) -> i128 {
        let debt_token: Address = env.storage().instance().get(&DataKey::DebtToken).unwrap();
        let client = token::Client::new(&env, &debt_token);
        client.balance(&env.current_contract_address())
    }

    // ---- Internal helpers ----

    /// Accrues linear interest on the user's principal up to the current
    /// ledger timestamp and persists the updated principal + timestamp.
    fn accrue(env: &Env, user: &Address) -> Result<(), Error> {
        let principal_key = DataKey::Principal(user.clone());
        let principal: i128 = env.storage().persistent().get(&principal_key).unwrap_or(0);

        if principal == 0 {
            env.storage()
                .persistent()
                .set(&DataKey::LastAccrued(user.clone()), &env.ledger().timestamp());
            return Ok(());
        }

        let last_key = DataKey::LastAccrued(user.clone());
        let last: u64 = env.storage().persistent().get(&last_key).unwrap_or(env.ledger().timestamp());
        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(last) as i128;

        if elapsed > 0 {
            let rate_bps: i128 = env.storage().instance().get(&DataKey::RateBps).unwrap();
            let interest = principal * rate_bps * elapsed / (BPS * SECONDS_PER_YEAR);
            let new_principal = principal + interest;
            env.storage()
                .persistent()
                .set(&principal_key, &new_principal);
        }

        env.storage().persistent().set(&last_key, &now);
        Ok(())
    }

    /// Read-only debt simulation including interest accrued since
    /// `LastAccrued`, without mutating storage.
    fn current_debt(env: &Env, user: &Address) -> i128 {
        let principal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Principal(user.clone()))
            .unwrap_or(0);
        if principal == 0 {
            return 0;
        }
        let last: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LastAccrued(user.clone()))
            .unwrap_or(env.ledger().timestamp());
        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(last) as i128;
        let rate_bps: i128 = env.storage().instance().get(&DataKey::RateBps).unwrap();
        let interest = principal * rate_bps * elapsed / (BPS * SECONDS_PER_YEAR);
        principal + interest
    }

    fn health_factor_bps(env: &Env, user: &Address) -> i128 {
        let collateral: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Collateral(user.clone()))
            .unwrap_or(0);
        let debt = Self::current_debt(env, user);
        if debt == 0 {
            return i128::MAX;
        }
        let price: i128 = env.storage().instance().get(&DataKey::PriceScaled).unwrap();
        let collateral_value = collateral * price / SCALE;
        collateral_value * BPS / debt
    }
}

mod test;
