import { Asset, TimePointSec } from "@greymass/eosio";
import { Blockchain, mintTokens, nameToBigInt, symbolCodeToBigInt } from "@proton/vert";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const blockchain = new Blockchain();
const [dummycol, alice, bob, clark] = blockchain.createAccounts("dummycol", "alice", "bob", "clark");
const ezstakeContract = blockchain.createContract("ezstake", "contract/ezstake", true);
const eosioTokenContract = blockchain.createContract("eosio.token", "node_modules/proton-tsc/external/eosio.token/eosio.token", true);
const atomicassetsContract = blockchain.createContract("atomicassets", "node_modules/proton-tsc/external/atomicassets/atomicassets", true);

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

	// mint 4 assets from template 1 to alice
	for (let i = 0; i < 4; i++) {
		await atomicassetsContract.actions.mintasset(["dummycol", "dummycol", "dummyschema", 1, "alice", [], [], []]).send("dummycol@active");
	}

	// mint 4 assets from template 1 to bob
	for (let i = 0; i < 4; i++) {
		await atomicassetsContract.actions.mintasset(["dummycol", "dummycol", "dummyschema", 1, "bob", [], [], []]).send("dummycol@active");
	}
}

describe("claim", () => {
	describe("claim assets", () => {
		before(async () => {
			blockchain.resetTables();

			// to initiate the config table
			await ezstakeContract.actions.setconfig([600, 259200]).send();

			// create dummy collection
			await createDummyCollection();

			//  mint test tokens
			await mintTokens(eosioTokenContract, "WAX", 8, 3e9, 1e3, [ezstakeContract]);

			// set staking templates
			await ezstakeContract.actions.addtemplates([[{ template_id: 1, collection: "dummycol", hourly_rate: "0.00000001 WAX" }]]).send();

			// register alice & bob
			await ezstakeContract.actions.regnewuser(["alice"]).send("alice@active");
			await ezstakeContract.actions.regnewuser(["bob"]).send("bob@active");

			// set blockchain time
			blockchain.setTime(TimePointSec.fromString("2022-01-01T00:00:00"));

			// stake some assets for alice
			await atomicassetsContract.actions.transfer(["alice", "ezstake", ["1099511627776"], "stake"]).send("alice@active");
			// stake some assets for bob
			await atomicassetsContract.actions.transfer(["bob", "ezstake", ["1099511627780"], "stake"]).send("bob@active");
		});

		it("require user auth", () => {
			return assert.isRejected(
				ezstakeContract.actions.claim(["alice", []]).send("bob@active"),
				"user alice has not authorized this action"
			);
		});

		it("disallow non registered", () => {
			return assert.isRejected(ezstakeContract.actions.claim(["clark", []]).send("clark@active"), "user clark is not registered");
		});

		it("disallow non-staked assets", () => {
			return assert.isRejected(
				ezstakeContract.actions.claim(["alice", ["1099511627777"]]).send("alice@active"),
				"asset (1099511627777) is not staked"
			);
		});

		it("disallow wrong owner assets", () => {
			return assert.isRejected(
				ezstakeContract.actions.claim(["bob", ["1099511627776"]]).send("bob@active"),
				"asset (1099511627776) does not belong to bob"
			);
		});

		it("disallow empty claim", () => {
			// set blockchain time
			// 10 minutes after staking with very low rate should yield 0 less tokens than the token's native precision
			blockchain.setTime(TimePointSec.fromString("2022-01-01T00:10:01"));

			return assert.isRejected(ezstakeContract.actions.claim(["alice", ["1099511627776"]]).send("alice@active"), "nothing to claim");
		});

		it("claim tokens", async () => {
			blockchain.setTime(TimePointSec.fromString("2022-01-01T10:00:00"));

			return assert.isFulfilled(ezstakeContract.actions.claim(["alice", ["1099511627776"]]).send("alice@active"));
		});

		it("disallow while in cooldown", () => {
			// set blockchain time
			// 5 seconds after last cooldown
			blockchain.setTime(TimePointSec.fromString("2022-01-01T10:00:05"));

			return assert.isRejected(
				ezstakeContract.actions.claim(["alice", ["1099511627776"]]).send("alice@active"),
				"asset (1099511627776) is still in cooldown"
			);
		});

		describe("table storage", () => {
			before(async () => {
				blockchain.resetTables();

				// to initiate the config table
				await ezstakeContract.actions.setconfig([600, 259200]).send();

				// create dummy collection
				await createDummyCollection();

				//  mint test tokens
				await mintTokens(eosioTokenContract, "WAX", 8, 3e9, 1e3, [ezstakeContract]);

				// set staking templates
				await ezstakeContract.actions
					.addtemplates([[{ template_id: 1, collection: "dummycol", hourly_rate: "1.00000000 WAX" }]])
					.send();

				// register alice
				await ezstakeContract.actions.regnewuser(["alice"]).send("alice@active");

				// set staking templates
				await ezstakeContract.actions
					.addtemplates([[{ template_id: 1, collection: "dummycol", hourly_rate: "1.00000000 WAX" }]])
					.send();

				// set blockchain time for staking
				blockchain.setTime(TimePointSec.fromString("2022-01-01T00:00:00"));

				// stake some assets for alice
				await atomicassetsContract.actions.transfer(["alice", "ezstake", ["1099511627776"], "stake"]).send("alice@active");
			});

			it("update row", async () => {
				// set blockchain time for claiming
				blockchain.setTime(TimePointSec.fromString("2022-01-01T01:00:00"));

				await ezstakeContract.actions.claim(["alice", ["1099511627776"]]).send("alice@active");

				const [balance] = getTableRows<any[]>(blockchain, eosioTokenContract.name.toString(), "accounts", "alice");
				const assets = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "assets", ezstakeContract.name.toString());

				assert.deepEqual(balance, {
					primaryKey: symbolCodeToBigInt(Asset.SymbolCode.from("WAX")),
					payer: ezstakeContract.name.toString(),
					value: { balance: "1.00000000 WAX" },
				});

				assert.deepEqual(assets, [
					{
						primaryKey: 1099511627776n,
						payer: "alice",
						value: { asset_id: "1099511627776", owner: "alice", last_claim: "2022-01-01T01:00:00" },
						secondaryIndexes: [{ type: "idxu64", value: nameToBigInt("alice") }],
					},
				]);
			});
		});
	});
});
