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