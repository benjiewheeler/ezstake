#include <eosio/eosio.hpp>

using namespace eosio;

CONTRACT ezstake : public contract
{
public:
    using contract::contract;

    // ------------ admin actions ------------

    // freeze/unfreeze the contract
    ACTION setfrozen(const bool& is_frozen);

private:
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

    typedef singleton<name("config"), config> config_t;
};