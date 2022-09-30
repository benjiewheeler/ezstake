#include "atomicassets-interface.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>

using namespace eosio;

CONTRACT ezstake : public contract
{
public:
    using contract::contract;

    // ------------ structs ------------

    struct template_item {
        int32_t template_id;
        name collection;
        asset hourly_rate;
    };

    // ------------ admin actions ------------

    // freeze/unfreeze the contract
    ACTION setfrozen(const bool& is_frozen);

    // set the contract config
    ACTION setconfig(const uint32_t& min_claim_period, const uint32_t& unstake_period);

    // set the contract token config
    ACTION settoken(const name& contract, const symbol& symbol);

    // add the staking assets templates
    ACTION addtemplates(const std::vector<template_item>& templates);

    // remove the staking assets templates
    ACTION rmtemplates(const std::vector<template_item>& templates);

    // ------------ user actions ------------

    // register a new user
    ACTION regnewuser(const name& user);

    // claim the generated tokens
    ACTION claim(const name& user, const vector<uint64_t>& asset_ids);

    // ------------ notify handlers ------------

    // receiver assets from the user
    void receiveassets(name from, name to, vector<uint64_t> asset_ids, string memo);

private:
    // token stat struct
    struct stat_s {
        asset supply;
        asset max_supply;
        name issuer;

        uint64_t primary_key() const { return supply.symbol.code().raw(); }
    };

    TABLE user_s
    {
        name user;
        asset hourly_rate;

        auto primary_key() const { return user.value; }
        uint64_t by_rate() const { return hourly_rate.amount; }
    };

    TABLE asset_s
    {
        uint64_t asset_id;
        name owner;
        time_point_sec last_claim;

        auto primary_key() const { return asset_id; }
        uint64_t by_owner() const { return owner.value; }
    };

    TABLE template_s
    {
        int32_t template_id;
        name collection;
        asset hourly_rate;

        auto primary_key() const { return uint64_t(template_id); }
    };

    TABLE config
    {
        // is the contract frozen/stopped for maintenance/emergency
        bool is_frozen = 0;
        // the name of the token contract
        name token_contract = name("eosio.token");
        // the name of the token symbol
        symbol token_symbol = symbol(symbol_code("WAX"), 8);
        // the minimum time (in seconds) that a user is required to wait between each claim action
        uint32_t min_claim_period = 600;
        // the minimum time (in seconds) that a user is required to wait until they can unstake their assets
        uint32_t unstake_period = 86400 * 3;
    };

    // token stat table definition
    typedef multi_index<name("stat"), stat_s> stat_t;

    typedef multi_index<name("users"), user_s,
        indexed_by<name("rate"), const_mem_fun<user_s, uint64_t, &user_s::by_rate>>>
        user_t;

    typedef multi_index<name("assets"), asset_s,
        indexed_by<name("owner"), const_mem_fun<asset_s, uint64_t, &asset_s::by_owner>>>
        asset_t;

    typedef multi_index<name("templates"), template_s> template_t;
    typedef singleton<name("config"), config> config_t;

    // Utilities

    // check if the contract is initialized
    config check_config()
    {
        // get config table
        config_t conf_tbl(get_self(), get_self().value);

        // check if a config exists
        check(conf_tbl.exists(), "smart contract is not initialized yet");

        // get  current config
        const auto& conf = conf_tbl.get();

        // check if contract isn't frozen
        check(!conf.is_frozen, "smart contract is currently frozen");

        return conf;
    }
};