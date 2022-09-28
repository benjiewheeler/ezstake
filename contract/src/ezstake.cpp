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
