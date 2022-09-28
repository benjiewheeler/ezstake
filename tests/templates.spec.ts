import { Blockchain } from "@proton/vert";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const blockchain = new Blockchain();
const [dummycol, alice] = blockchain.createAccounts("dummycol", "alice");
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

	await atomicassetsContract.actions.createcol(["dummycol", "dummycol", true, ["dummycol"], [], 0.01, []]).send("dummycol@active");
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
}

describe("config", () => {
	describe("set templates", () => {
		before(async () => {
			blockchain.resetTables();

			// to initiate the config table
			await ezstakeContract.actions.setconfig([600, 259200]).send();

			// create dummy collection
			await createDummyCollection();
		});

		it("require contract auth", () => {
			return assert.isRejected(ezstakeContract.actions.addtemplates([[]]).send("alice@active"), "this action is admin only");
		});

		it("set the templates", async () => {
			return assert.isFulfilled(
				ezstakeContract.actions
					.addtemplates([
						[
							{ template_id: 1, collection: "dummycol", hourly_rate: "1.00000000 WAX" },
							{ template_id: 2, collection: "dummycol", hourly_rate: "2.00000000 WAX" },
						],
					])
					.send()
			);
		});

		describe("set invalid templates", () => {
			it("incorrect template/collection", () => {
				return assert.isRejected(
					ezstakeContract.actions
						.addtemplates([[{ template_id: 1, collection: "invalidcol", hourly_rate: "1.00000000 WAX" }]])
						.send(),
					"template (1) not found in collection invalidcol"
				);
			});

			it("incorrect template/collection", () => {
				return assert.isRejected(
					ezstakeContract.actions.addtemplates([[{ template_id: 99, collection: "dummycol", hourly_rate: "1.00000000 WAX" }]]).send(),
					"template (99) not found in collection dummycol"
				);
			});

			it("zero hourly rate", () => {
				return assert.isRejected(
					ezstakeContract.actions.addtemplates([[{ template_id: 3, collection: "dummycol", hourly_rate: "0.00000000 WAX" }]]).send(),
					"hourly_rate must be positive"
				);
			});

			it("negative hourly rate", () => {
				return assert.isRejected(
					ezstakeContract.actions.addtemplates([[{ template_id: 3, collection: "dummycol", hourly_rate: "-1.00000000 WAX" }]]).send(),
					"hourly_rate must be positive"
				);
			});

			it("wrong token", () => {
				return assert.isRejected(
					ezstakeContract.actions.addtemplates([[{ template_id: 3, collection: "dummycol", hourly_rate: "1.0000 BTC" }]]).send(),
					"symbol mismatch"
				);
			});
		});

		describe("table storage", () => {
			before(async () => {
				blockchain.resetTables();

				// to initiate the config table
				await ezstakeContract.actions.setconfig([600, 259200]).send();

				// create dummy collection
				await createDummyCollection();
			});

			it("update row", async () => {
				await ezstakeContract.actions
					.addtemplates([
						[
							{ template_id: 1, collection: "dummycol", hourly_rate: "1.00000000 WAX" },
							{ template_id: 2, collection: "dummycol", hourly_rate: "2.00000000 WAX" },
						],
					])
					.send();

				const rows = getTableRows<any[]>(blockchain, ezstakeContract.name.toString(), "templates", ezstakeContract.name.toString());

				return assert.deepEqual(rows, [
					{
						primaryKey: 1n,
						payer: ezstakeContract.name.toString(),
						value: { template_id: 1, collection: "dummycol", hourly_rate: "1.00000000 WAX" },
					},
					{
						primaryKey: 2n,
						payer: ezstakeContract.name.toString(),
						value: { template_id: 2, collection: "dummycol", hourly_rate: "2.00000000 WAX" },
					},
				]);
			});
		});
	});
});
