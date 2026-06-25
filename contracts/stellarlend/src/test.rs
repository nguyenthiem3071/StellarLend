#![cfg(test)]

use crate::{StellarLend, StellarLendClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

fn create_token<'a>(env: &Env, admin: &Address) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    (
        token::Client::new(env, &sac.address()),
        token::StellarAssetClient::new(env, &sac.address()),
    )
}

#[test]
fn test_deposit_borrow_repay_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (xlm, xlm_admin) = create_token(&env, &admin);
    let (usdc, usdc_admin) = create_token(&env, &admin);

    // Fund user with 1000 XLM (7-decimal units)
    xlm_admin.mint(&user, &10_000_0000000i128);
    // Fund pool with 1000 USDC liquidity
    let contract_id = env.register(StellarLend, ());
    usdc_admin.mint(&contract_id, &1_000_0000000i128);

    let client = StellarLendClient::new(&env, &contract_id);

    // 1:1 price, 75% LTV, 85% liquidation threshold, 8% APR
    client.initialize(&admin, &xlm.address, &usdc.address, &7500, &8500, &800, &10_000_000);

    // Deposit 100 XLM
    client.deposit(&user, &1000_0000000i128);
    assert_eq!(client.get_collateral(&user), 1000_0000000);

    // Borrow up to 75% = 750 USDC
    client.borrow(&user, &500_0000000i128);
    assert_eq!(client.get_debt(&user), 500_0000000);

    // health factor = collateral_value / debt = 1000/500 * 10000 = 20000 bps (200%)
    assert_eq!(client.health_factor(&user), 20000);

    // Borrowing more than LTV allows should fail
    let over = client.try_borrow(&user, &300_0000000i128);
    assert!(over.is_err());

    // Repay partially
    client.repay(&user, &200_0000000i128);
    assert_eq!(client.get_debt(&user), 300_0000000);

    // Withdraw some collateral while staying within LTV
    client.withdraw(&user, &100_0000000i128);
    assert_eq!(client.get_collateral(&user), 900_0000000);
}

#[test]
fn test_interest_accrual() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (xlm, xlm_admin) = create_token(&env, &admin);
    let (usdc, usdc_admin) = create_token(&env, &admin);

    xlm_admin.mint(&user, &10_000_0000000i128);

    let contract_id = env.register(StellarLend, ());
    usdc_admin.mint(&contract_id, &1_000_0000000i128);

    let client = StellarLendClient::new(&env, &contract_id);
    client.initialize(&admin, &xlm.address, &usdc.address, &7500, &8500, &1000, &10_000_000); // 10% APR

    client.deposit(&user, &1000_0000000i128);
    client.borrow(&user, &100_0000000i128);

    // Advance time by 1 year
    env.ledger().with_mut(|l| {
        l.timestamp += 365 * 24 * 60 * 60;
    });

    // Debt should have grown by ~10%
    let debt = client.get_debt(&user);
    assert!(debt > 109_0000000 && debt <= 110_0000000);
}

#[test]
fn test_liquidation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let liquidator = Address::generate(&env);

    let (xlm, xlm_admin) = create_token(&env, &admin);
    let (usdc, usdc_admin) = create_token(&env, &admin);

    xlm_admin.mint(&user, &1000_0000000i128);
    usdc_admin.mint(&liquidator, &1000_0000000i128);

    let contract_id = env.register(StellarLend, ());
    usdc_admin.mint(&contract_id, &1000_0000000i128);

    let client = StellarLendClient::new(&env, &contract_id);
    // 1:1 price, 75% LTV, 85% liq threshold, 20% APR (high to force unhealthy quickly)
    client.initialize(&admin, &xlm.address, &usdc.address, &7500, &8500, &2000, &10_000_000);

    client.deposit(&user, &1000_0000000i128);
    client.borrow(&user, &750_0000000i128); // exactly at 75% LTV, health = 13333 bps

    // Not liquidatable yet (health 13333 > 8500 threshold)
    let res = client.try_liquidate(&liquidator, &user);
    assert!(res.is_err());

    // Advance time enough for interest to push health factor below threshold.
    // health = collateral / debt * 10000 < 8500  =>  debt > collateral * 10000/8500
    // collateral = 1000, so debt > 1176.47. With 20% APR starting at 750,
    // need debt to grow from 750 to >1176 => ~2.85 years.
    env.ledger().with_mut(|l| {
        l.timestamp += 3 * 365 * 24 * 60 * 60;
    });

    client.liquidate(&liquidator, &user);
    assert_eq!(client.get_collateral(&user), 0);
    assert_eq!(client.get_debt(&user), 0);
}
