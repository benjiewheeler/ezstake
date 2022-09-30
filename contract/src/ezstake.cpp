#include <ezstake.hpp>

ACTION ezstake::setfrozen(const bool& is_frozen)
{
    // check contract auth
    check(has_auth(get_self()), "this action is admin only");

    // get config table instance
    config_t conf_tbl(get_self(), get_self().value);

    // get/create current config
    auto conf = conf_tbl.get_or_default(config {});

    check(!(conf.is_frozen && is_frozen), "contract is already frozen");
    check(!(!conf.is_frozen && !is_frozen), "contract is already non-frozen");

    conf.is_frozen = is_frozen;

    // save the new config
    conf_tbl.set(conf, get_self());
}

ACTION ezstake::setconfig(const uint32_t& min_claim_period, const uint32_t& unstake_period)
{
    // check contract auth
    check(has_auth(get_self()), "this action is admin only");

    // get config table instance
    config_t conf_tbl(get_self(), get_self().value);

    // get/create current config
    auto conf = conf_tbl.get_or_default(config {});

    conf.min_claim_period = min_claim_period;
    conf.unstake_period = unstake_period;

    // save the new config
    conf_tbl.set(conf, get_self());
}

ACTION ezstake::settoken(const name& contract, const symbol& symbol)
{
    // check contract auth
    check(has_auth(get_self()), "this action is admin only");

    // check if the contract exists
    check(is_account(contract), "contract account does not exist");

    // check if the contract has a token and is valid
    stat_t stat(contract, symbol.code().raw());
    stat.require_find(symbol.code().raw(), "token symbol does not exist");

    // get config table instance
    config_t conf_tbl(get_self(), get_self().value);

    // get/create current config
    auto conf = conf_tbl.get_or_default(config {});

    conf.token_contract = contract;
    conf.token_symbol = symbol;

    // save the new config
    conf_tbl.set(conf, get_self());
}

ACTION ezstake::addtemplates(const std::vector<template_item>& templates)
{
    // check contract auth
    check(has_auth(get_self()), "this action is admin only");

    // check if the contract isn't frozen
    const auto& config = check_config();

    // get templates table instance
    template_t template_tbl(get_self(), get_self().value);

    for (const template_item& t : templates) {
        // check if the hourly rate is valid
        check(t.hourly_rate.amount > 0, "hourly_rate must be positive");
        check(config.token_symbol == t.hourly_rate.symbol, "symbol mismatch");

        // check if the template exists in atomicassets and it's valid
        const auto& aa_template_tbl = atomicassets::get_templates(t.collection);

        const auto& aa_template_itr = aa_template_tbl.find(uint64_t(t.template_id));

        if (aa_template_itr == aa_template_tbl.end()) {
            check(false, string("template (" + to_string(t.template_id) + ") not found in collection " + t.collection.to_string()).c_str());
        }

        const auto& template_row = template_tbl.find(uint64_t(t.template_id));

        // insert the new template or update it if it already exists
        if (template_row == template_tbl.end()) {
            template_tbl.emplace(get_self(), [&](template_s& row) {
                row.template_id = t.template_id;
                row.collection = t.collection;
                row.hourly_rate = t.hourly_rate;
            });
        } else {
            template_tbl.modify(template_row, get_self(), [&](template_s& row) {
                row.template_id = t.template_id;
                row.collection = t.collection;
                row.hourly_rate = t.hourly_rate;
            });
        }
    }
}

ACTION ezstake::rmtemplates(const std::vector<template_item>& templates)
{
    // check contract auth
    check(has_auth(get_self()), "this action is admin only");

    // check if the contract isn't frozen
    const auto& config = check_config();

    // get templates table instance
    template_t template_tbl(get_self(), get_self().value);

    for (const template_item& t : templates) {
        const auto& template_row = template_tbl.find(uint64_t(t.template_id));

        // erase the template if it already exists
        if (template_row != template_tbl.end()) {
            template_tbl.erase(template_row);
        }
    }
}

ACTION ezstake::regnewuser(const name& user)
{
    // check user auth
    if (!has_auth(user)) {
        check(false, string("user " + user.to_string() + " has not authorized this action").c_str());
    }

    // check if the contract isn't frozen
    const auto& config = check_config();

    // get users table instance
    user_t user_tbl(get_self(), get_self().value);

    const auto& user_itr = user_tbl.find(user.value);

    // check if the user isn't already registered
    if (user_itr != user_tbl.end()) {
        check(false, string("user " + user.to_string() + " is already registered").c_str());
    }

    user_tbl.emplace(user, [&](user_s& row) {
        row.user = user;
        row.hourly_rate = asset(0, config.token_symbol);
    });
}

ACTION ezstake::claim(const name& user, const vector<uint64_t>& asset_ids)
{
    // check user auth
    if (!has_auth(user)) {
        check(false, string("user " + user.to_string() + " has not authorized this action").c_str());
    }

    // check if the contract isn't frozen
    const auto& config = check_config();

    // get users table instance
    user_t user_tbl(get_self(), get_self().value);

    const auto& user_itr = user_tbl.find(user.value);

    // check if the user is registered
    if (user_itr == user_tbl.end()) {
        check(false, string("user " + user.to_string() + " is not registered").c_str());
    }

    // get template table instance
    template_t template_tbl(get_self(), get_self().value);
    // get asset table instance
    asset_t asset_tbl(get_self(), get_self().value);

    asset claimed_amount = asset(0, config.token_symbol);

    // get the assets table (scoped to the contract)
    const auto& aa_asset_tbl = atomicassets::get_assets(get_self());

    for (const uint64_t& asset_id : asset_ids) {
        // find the asset data, to get the template id from it
        const auto& asset_itr = asset_tbl.find(asset_id);

        // check if the asset is staked
        if (asset_itr == asset_tbl.end()) {
            check(false, string("asset (" + to_string(asset_id) + ") is not staked").c_str());
        }

        // check if the asset belongs to the user
        if (asset_itr->owner != user) {
            check(false, string("asset (" + to_string(asset_id) + ") does not belong to " + user.to_string()).c_str());
        }

        // find the asset data, to get the template id from it
        const auto& aa_asset_itr = aa_asset_tbl.find(asset_id);

        if (aa_asset_itr == aa_asset_tbl.end()) {
            check(false, string("assert (" + to_string(asset_id) + ") does not exist").c_str());
        }

        // check if the asset's template is stakeable
        const auto& template_itr = template_tbl.find(aa_asset_itr->template_id);

        if (template_itr == template_tbl.end()) {
            check(false, string("asset (" + to_string(asset_id) + ") is not stakeable").c_str());
        }

        auto period_sec = current_time_point().sec_since_epoch() - asset_itr->last_claim.sec_since_epoch();

        // check if the asset is not in cooldown
        if (period_sec < config.min_claim_period) {
            check(false, string("asset (" + to_string(asset_id) + ") is still in cooldown").c_str());
        }

        // increment the claimed amount
        claimed_amount.amount += (template_itr->hourly_rate.amount * period_sec) / 3600;

        // reset the last claim time
        asset_tbl.modify(asset_itr, user, [&](asset_s& row) { row.last_claim = current_time_point(); });
    }

    // fail if the reward is 0
    check(claimed_amount.amount > 0, "nothing to claim");

    // send the tokens
    action(permission_level { get_self(), name("active") }, config.token_contract, name("transfer"),
        make_tuple(get_self(), user, claimed_amount, string("Staking reward")))
        .send();
}

[[eosio::on_notify("atomicassets::transfer")]] void
ezstake::receiveassets(name from, name to, vector<uint64_t> asset_ids, string memo)
{
    // ignore outgoing transactions and transaction not destined to the dapp itself
    if (to != get_self() || from == get_self()) {
        return;
    }

    // ignore transactions if the memo isn't stake
    if (memo != "stake") {
        return;
    }

    // check if the contract isn't frozen
    const auto& config = check_config();

    // get users table instance
    user_t user_tbl(get_self(), get_self().value);

    const auto& user_itr = user_tbl.find(from.value);

    // check if the user is registered
    if (user_itr == user_tbl.end()) {
        check(false, string("user " + from.to_string() + " is not registered").c_str());
    }

    // get the assets table (scoped to the contract)
    const auto& aa_asset_tbl = atomicassets::get_assets(get_self());

    // get template table instance
    template_t template_tbl(get_self(), get_self().value);
    // get asset table instance
    asset_t asset_tbl(get_self(), get_self().value);

    asset added_rate = asset(0, config.token_symbol);

    for (const uint64_t& asset_id : asset_ids) {
        // find the asset data, to get the template id from it
        const auto& aa_asset_itr = aa_asset_tbl.find(asset_id);

        if (aa_asset_itr == aa_asset_tbl.end()) {
            check(false, string("assert (" + to_string(asset_id) + ") does not exist").c_str());
        }

        // check if the asset's template is stakeable
        const auto& template_itr = template_tbl.find(aa_asset_itr->template_id);

        if (template_itr == template_tbl.end()) {
            check(false, string("asset (" + to_string(asset_id) + ") is not stakeable").c_str());
        }

        // increment the added rate
        added_rate += template_itr->hourly_rate;

        // save the asset
        asset_tbl.emplace(get_self(), [&](asset_s& row) {
            row.asset_id = asset_id;
            row.owner = from;
            row.last_claim = time_point_sec(current_time_point());
        });
    }

    // save the new rate
    user_tbl.modify(user_itr, same_payer, [&](auto& row) {
        row.hourly_rate += added_rate;
    });
}
