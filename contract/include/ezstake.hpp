#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>

using namespace eosio;

CONTRACT ezstake : public contract
{
public:
    using contract::contract;

    // ------------ admin actions ------------

    // freeze/unfreeze the contract
    ACTION setfrozen(const bool& is_frozen);

    // set the contract config
    ACTION setconfig(const uint32_t& min_claim_period, const uint32_t& unstake_period);

    // set the contract token config
    ACTION settoken(const name& contract, const symbol& symbol);

private:
    // token stat struct
    struct stat_s {
        asset supply;
        asset max_supply;
        name issuer;

        uint64_t primary_key() const { return supply.symbol.code().raw(); }
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

    typedef singleton<name("config"), config> config_t;
};