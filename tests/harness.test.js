import assert from "node:assert";
import { test } from "node:test";
import { createHarnessServer } from "../scripts/dev-placeholder.js";

test("placeholder server responds with Harness Ready", async () => {
	const server = createHarnessServer();

	await new Promise((resolve) => {
		server.listen(0, "127.0.0.1", resolve);
	});

	const addr = server.address();
	const actualPort = addr.port;

	try {
		const response = await fetch(`http://127.0.0.1:${actualPort}`);
		assert.strictEqual(response.status, 200);
		const body = await response.text();
		assert.ok(
			body.includes("Harness Ready"),
			'Response should contain "Harness Ready"',
		);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
});
