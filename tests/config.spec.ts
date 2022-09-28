import { Blockchain, mintTokens, nameToBigInt } from "@proton/vert";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const blockchain = new Blockchain();
const [alice, bob] = blockchain.createAccounts("alice", "bob");
const ezstakeContract = blockchain.createContract("ezstake", "contract/ezstake");
const atomicassetsContract = blockchain.createContract("atomicassets", "node_modules/proton-tsc/external/atomicassets/atomicassets");
const eosioTokenContract = blockchain.createContract("eosio.token", "node_modules/proton-tsc/external/eosio.token/eosio.token");
const testTokenContract = blockchain.createContract("test.token", "node_modules/proton-tsc/external/eosio.token/eosio.token");

function getTableRows<T>(blockchain: Blockchain, code: string, table: string, scope: string): T {
	return blockchain.getStorage()[code][table][scope];
}

const DEFAULT_CONFIG_ROW = {
	is_frozen: false,
	token_contract: "eosio.token",
	token_symbol: "8,WAX",
	min_claim_period: 600,
	unstake_period: 259200,
};

describe("config", () => {
	describe("freeze", () => {
		before(() => {
			blockchain.resetTables();
		});

		it("require contract auth", () => {
			return assert.isRejected(ezstakeContract.actions.setfrozen([true]).send("alice@active"), "this action is admin only");
		});

		it("freeze the contract", () => {
			return assert.isFulfilled(ezstakeContract.actions.setfrozen([true]).send());
		});

		it("disallow freeze when frozen", () => {
			return assert.isRejected(ezstakeContract.actions.setfrozen([true]).send(), "contract is already frozen");
		});

		it("freeze the contract", () => {
			return assert.isFulfilled(ezstakeContract.actions.setfrozen([false]).send());
		});

		it("disallow unfreeze when not frozen", () => {
			return assert.isRejected(ezstakeContract.actions.setfrozen([false]).send(), "contract is already non-frozen");
		});

		describe("table storage", () => {
			before(() => {
				blockchain.resetTables();
			});

			it("after freeze", async () => {
				await ezstakeContract.actions.setfrozen([true]).send();

				const [row] = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "config", ezstakeContract.name.toString());

				return assert.deepEqual(row, {
					primaryKey: nameToBigInt("config"),
					payer: ezstakeContract.name.toString(),
					value: { ...DEFAULT_CONFIG_ROW, is_frozen: true },
				});
			});

			it("after unfreeze", async () => {
				await ezstakeContract.actions.setfrozen([false]).send();

				const [row] = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "config", ezstakeContract.name.toString());

				return assert.deepEqual(row, {
					primaryKey: nameToBigInt("config"),
					payer: ezstakeContract.name.toString(),
					value: { ...DEFAULT_CONFIG_ROW, is_frozen: false },
				});
			});
		});
	});

	describe("set config", () => {
		before(() => {
			blockchain.resetTables();
		});

		it("require contract auth", () => {
			return assert.isRejected(ezstakeContract.actions.setconfig([600, 259200]).send("alice@active"), "this action is admin only");
		});

		it("set the config", () => {
			return assert.isFulfilled(ezstakeContract.actions.setconfig([600, 259200]).send());
		});

		describe("table storage", () => {
			before(() => {
				blockchain.resetTables();
			});

			it("update row", async () => {
				await ezstakeContract.actions.setconfig([400, 250000]).send();

				const [row] = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "config", ezstakeContract.name.toString());

				return assert.deepEqual(row, {
					primaryKey: nameToBigInt("config"),
					payer: ezstakeContract.name.toString(),
					value: { ...DEFAULT_CONFIG_ROW, min_claim_period: 400, unstake_period: 250000 },
				});
			});
		});
	});

	describe("set token", () => {
		before(async () => {
			blockchain.resetTables();

			await mintTokens(eosioTokenContract, "WAX", 8, 3e9, 1e3, [alice, bob]);
			await mintTokens(testTokenContract, "BTC", 8, 21e6, 100, [alice, bob]);
		});

		it("require contract auth", () => {
			return assert.isRejected(
				ezstakeContract.actions.settoken(["eosio.token", "8,WAX"]).send("alice@active"),
				"this action is admin only"
			);
		});

		it("set the config", async () => {
			return assert.isFulfilled(ezstakeContract.actions.settoken(["eosio.token", "8,WAX"]).send());
		});

		it("disallow non-existing contracts", () => {
			return assert.isRejected(ezstakeContract.actions.settoken(["dummy", "8,WAX"]).send(), "contract account does not exist");
		});

		it("disallow non-token contracts", () => {
			return assert.isRejected(ezstakeContract.actions.settoken(["atomicassets", "8,WAX"]).send(), "token symbol does not exist");
		});

		it("disallow non-existing tokens", () => {
			return assert.isRejected(ezstakeContract.actions.settoken(["eosio.token", "4,TLM"]).send(), "token symbol does not exist");
		});

		describe("table storage", () => {
			before(async () => {
				blockchain.resetTables();

				await mintTokens(eosioTokenContract, "WAX", 8, 3e9, 1e3, [alice, bob]);
				await mintTokens(testTokenContract, "BTC", 8, 21e6, 100, [alice, bob]);
			});

			it("update row", async () => {
				await ezstakeContract.actions.settoken(["test.token", "8,BTC"]).send();

				const [row] = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "config", ezstakeContract.name.toString());

				return assert.deepEqual(row, {
					primaryKey: nameToBigInt("config"),
					payer: ezstakeContract.name.toString(),
					value: { ...DEFAULT_CONFIG_ROW, token_contract: "test.token", token_symbol: "8,BTC" },
				});
			});
		});
	});
});
