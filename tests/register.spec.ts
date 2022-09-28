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

describe("register player", () => {
	describe("workflow", () => {
		before(async () => {
			blockchain.resetTables();

			// to initiate the config table
			await ezstakeContract.actions.setconfig([600, 259200]).send();
		});

		it("require user auth", () => {
			return assert.isRejected(
				ezstakeContract.actions.regnewuser(["alice"]).send("bob@active"),
				"user alice has not authorized this action"
			);
		});

		it("register the user", async () => {
			return assert.isFulfilled(ezstakeContract.actions.regnewuser(["alice"]).send("alice@active"));
		});

		it("disallow duplicates", () => {
			return assert.isRejected(ezstakeContract.actions.regnewuser(["alice"]).send("alice@active"), "user alice is already registered");
		});

		describe("table storage", () => {
			before(async () => {
				blockchain.resetTables();

				// to initiate the config table
				await ezstakeContract.actions.setconfig([600, 259200]).send();
			});

			it("add row", async () => {
				await ezstakeContract.actions.regnewuser(["alice"]).send("alice@active");

				const [row] = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "users", ezstakeContract.name.toString());

				return assert.deepEqual(row, {
					primaryKey: nameToBigInt("alice"),
					payer: "alice",
					value: { user: "alice", hourly_rate: "0.00000000 WAX" },
					secondaryIndexes: [{ type: "idxu64", value: 0n }],
				});
			});
		});
	});
});
