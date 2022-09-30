import { TimePointSec } from "@greymass/eosio";
import { Blockchain, nameToBigInt } from "@proton/vert";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const blockchain = new Blockchain();
const [dummycol, alice, bob] = blockchain.createAccounts("dummycol", "alice", "bob");
const ezstakeContract = blockchain.createContract("ezstake", "contract/ezstake");
const atomicassetsContract = blockchain.createContract("atomicassets", "node_modules/proton-tsc/external/atomicassets/atomicassets");

function getTableRows<T>(blockchain: Blockchain, code: string, table: string, scope: string): T {
	return blockchain.getStorage()[code][table][scope];
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

	// mint 4 assets from template 1
	for (let i = 0; i < 4; i++) {
		await atomicassetsContract.actions.mintasset(["dummycol", "dummycol", "dummyschema", 1, "alice", [], [], []]).send("dummycol@active");
	}

	// mint 10 assets from each of the templates 2,3,4,5
	for (let i = 2; i <= 5; i++) {
		for (let j = 0; j < 10; j++) {
			await atomicassetsContract.actions
				.mintasset(["dummycol", "dummycol", "dummyschema", i, "alice", [], [], []])
				.send("dummycol@active");
		}
	}
}

describe("stake", () => {
	describe("send assets", () => {
		before(async () => {
			blockchain.resetTables();

			// to initiate the config table
			await ezstakeContract.actions.setconfig([600, 259200]).send();

			// create dummy collection
			await createDummyCollection();

			// set staking templates
			await ezstakeContract.actions
				.addtemplates([
					[
						{ template_id: 1, collection: "dummycol", hourly_rate: "1.00000000 WAX" },
						{ template_id: 2, collection: "dummycol", hourly_rate: "2.00000000 WAX" },
					],
				])
				.send();
		});

		it("ignore other notifications", () => {
			return assert.isFulfilled(atomicassetsContract.actions.transfer(["alice", "bob", ["1099511627776"], "memo"]).send("alice@active"));
		});

		it("ignore non-stake memos", () => {
			return assert.isFulfilled(
				atomicassetsContract.actions.transfer(["alice", "ezstake", ["1099511627777"], "deposit"]).send("alice@active")
			);
		});

		it("disallow non registered", () => {
			return assert.isRejected(
				atomicassetsContract.actions.transfer(["alice", "ezstake", ["1099511627778"], "stake"]).send("alice@active"),
				"user alice is not registered"
			);
		});

		it("stake assets", async () => {
			// register alice first
			await ezstakeContract.actions.regnewuser(["alice"]).send("alice@active");

			return assert.isFulfilled(
				atomicassetsContract.actions.transfer(["alice", "ezstake", ["1099511627779"], "stake"]).send("alice@active")
			);
		});

		it("disallow unstakeable templates", () => {
			return assert.isRejected(
				atomicassetsContract.actions.transfer(["alice", "ezstake", ["1099511627800"], "stake"]).send("alice@active"),
				"asset (1099511627800) is not stakeable"
			);
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
					.addtemplates([
						[
							{ template_id: 1, collection: "dummycol", hourly_rate: "1.00000000 WAX" },
							{ template_id: 2, collection: "dummycol", hourly_rate: "2.00000000 WAX" },
						],
					])
					.send();

				// register alice first
				await ezstakeContract.actions.regnewuser(["alice"]).send("alice@active");
			});

			it("update row", async () => {
				// set blockchain time
				blockchain.setTime(TimePointSec.fromString("2022-01-01T00:00:00"));

				await atomicassetsContract.actions.transfer(["alice", "ezstake", ["1099511627779"], "stake"]).send("alice@active");

				const [user] = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "users", ezstakeContract.name.toString());
				const assets = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "assets", ezstakeContract.name.toString());

				assert.deepEqual(user, {
					primaryKey: nameToBigInt("alice"),
					payer: "alice",
					value: { user: "alice", hourly_rate: "1.00000000 WAX" },
					secondaryIndexes: [{ type: "idxu64", value: 100000000n }],
				});

				assert.deepEqual(assets, [
					{
						primaryKey: 1099511627779n,
						payer: ezstakeContract.name.toString(),
						value: { asset_id: "1099511627779", owner: "alice", last_claim: "2022-01-01T00:00:00" },
						secondaryIndexes: [{ type: "idxu64", value: nameToBigInt("alice") }],
					},
				]);
			});
		});
	});
});
