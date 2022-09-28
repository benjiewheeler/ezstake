import { Blockchain, nameToBigInt } from "@proton/vert";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const blockchain = new Blockchain();
const [alice, bob] = blockchain.createAccounts("alice", "bob");
const ezstakeContract = blockchain.createContract("ezstake", "contract/ezstake");

function getTableRows<T>(blockchain: Blockchain, code: string, table: string, scope: string): T {
	return blockchain.getStorage()[code][table][scope];
}

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
					value: {
						is_frozen: true,
						token_contract: "eosio.token",
						token_symbol: "8,WAX",
						min_claim_period: 600,
						unstake_period: 259200,
					},
				});
			});
			it("after unfreeze", async () => {
				await ezstakeContract.actions.setfrozen([false]).send();

				const [row] = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "config", ezstakeContract.name.toString());

				return assert.deepEqual(row, {
					primaryKey: nameToBigInt("config"),
					payer: ezstakeContract.name.toString(),
					value: {
						is_frozen: false,
						token_contract: "eosio.token",
						token_symbol: "8,WAX",
						min_claim_period: 600,
						unstake_period: 259200,
					},
				});
			});
		});
	});
});
