import { TimePointSec } from "@greymass/eosio";
import { Blockchain, nameToBigInt } from "@proton/vert";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const blockchain = new Blockchain();
const [dummycol, alice, bob, clark] = blockchain.createAccounts("dummycol", "alice", "bob", "clark");
const ezstakeContract = blockchain.createContract("ezstake", "contract/ezstake", true);
const atomicassetsContract = blockchain.createContract("atomicassets", "node_modules/proton-tsc/external/atomicassets/atomicassets", true);

function getTableRows<T>(blockchain: Blockchain, code: string, table: string, scope: string): T {
	const storage = blockchain.getStorage();
	const contractStorage = storage[code] || {};
	const tableStorage = contractStorage[table] || {};
	const scopeStorage = tableStorage[scope] || [];
	return scopeStorage;
}

async function createDummyCollection() {
	await atomicassetsContract.actions.init().send();
	await atomicassetsContract.actions
		.admincoledit([
			[
				{ name: "name", type: "string" },
				{ name: "img", type: "ipfs" },
				{ name: "description", type: "string" },
				{ name: "url", type: "string" },
			],
		])
		.send();

	await atomicassetsContract.actions.createcol(["dummycol", "dummycol", true, ["dummycol", "ezstake"], [], 0.01, []]).send("dummycol@active");
	await atomicassetsContract.actions
		.createschema([
			"dummycol",
			"dummycol",
			"dummyschema",
			[
				{ name: "image", type: "string" },
				{ name: "name", type: "string" },
			],
		])
		.send("dummycol@active");

	for (let i = 0; i < 5; i++) {
		await atomicassetsContract.actions
			.createtempl([
				"dummycol",
				"dummycol",
				"dummyschema",
				true,
				true,
				100000,
				[
					{ key: "image", value: ["string", "dummy.png"] },
					{ key: "name", value: ["string", "Dummy"] },
				],
			])
			.send("dummycol@active");
	}

	// mint 4 assets from template 1 to alice
	for (let i = 0; i < 4; i++) {
		await atomicassetsContract.actions.mintasset(["dummycol", "dummycol", "dummyschema", 1, "alice", [], [], []]).send("dummycol@active");
	}

	// mint 4 assets from template 1 to bob
	for (let i = 0; i < 4; i++) {
		await atomicassetsContract.actions.mintasset(["dummycol", "dummycol", "dummyschema", 1, "bob", [], [], []]).send("dummycol@active");
	}
}

describe("reset", () => {
	describe("reset user", () => {
		before(async () => {
			blockchain.resetTables();

			// to initiate the config table
			await ezstakeContract.actions.setconfig([600, 259200]).send();

			// create dummy collection
			await createDummyCollection();

			// set staking templates
			await ezstakeContract.actions.addtemplates([[{ template_id: 1, collection: "dummycol", hourly_rate: "1.00000000 WAX" }]]).send();

			// register alice & bob
			await ezstakeContract.actions.regnewuser(["alice"]).send("alice@active");
			await ezstakeContract.actions.regnewuser(["bob"]).send("bob@active");

			// set blockchain time
			blockchain.setTime(TimePointSec.fromString("2022-01-01T00:00:00"));

			// stake some assets for alice
			await atomicassetsContract.actions.transfer(["alice", "ezstake", ["1099511627776", "1099511627777"], "stake"]).send("alice@active");
			// stake some assets for bob
			await atomicassetsContract.actions.transfer(["bob", "ezstake", ["1099511627780"], "stake"]).send("bob@active");
		});

		it("require contract auth", () => {
			return assert.isRejected(ezstakeContract.actions.resetuser(["alice"]).send("alice@active"), "this action is admin only");
		});

		it("reset the user", async () => {
			return assert.isFulfilled(ezstakeContract.actions.resetuser(["alice"]).send());
		});

		describe("table storage", () => {
			before(async () => {
				blockchain.resetTables();

				// to initiate the config table
				await ezstakeContract.actions.setconfig([600, 259200]).send();

				// create dummy collection
				await createDummyCollection();

				// set staking templates
				await ezstakeContract.actions
					.addtemplates([[{ template_id: 1, collection: "dummycol", hourly_rate: "1.00000000 WAX" }]])
					.send();

				// register alice & bob
				await ezstakeContract.actions.regnewuser(["alice"]).send("alice@active");
				await ezstakeContract.actions.regnewuser(["bob"]).send("bob@active");

				// set blockchain time
				blockchain.setTime(TimePointSec.fromString("2022-01-01T00:00:00"));

				// stake some assets for alice
				await atomicassetsContract.actions
					.transfer(["alice", "ezstake", ["1099511627776", "1099511627777"], "stake"])
					.send("alice@active");
				// stake some assets for bob
				await atomicassetsContract.actions.transfer(["bob", "ezstake", ["1099511627780"], "stake"]).send("bob@active");
			});

			it("update row", async () => {
				await ezstakeContract.actions.resetuser(["alice"]).send();

				const players = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "users", ezstakeContract.name.toString());
				const assets = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "assets", ezstakeContract.name.toString());

				assert.deepEqual(players, [
					{
						primaryKey: nameToBigInt("bob"),
						payer: "bob",
						value: { user: "bob", hourly_rate: "1.00000000 WAX" },
						secondaryIndexes: [{ type: "idxu64", value: 100000000n }],
					},
				]);
				assert.deepEqual(assets, [
					{
						primaryKey: 1099511627780n,
						payer: ezstakeContract.name.toString(),
						value: { asset_id: "1099511627780", owner: "bob", last_claim: "2022-01-01T00:00:00" },
						secondaryIndexes: [{ type: "idxu64", value: nameToBigInt("bob") }],
					},
				]);
			});
		});
	});
});
