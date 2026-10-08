import assert from "node:assert";
import { createServer } from "node:http";
import { test } from "node:test";

test("placeholder server responds with Harness Ready", async () => {
	const port = 0; // Use ephemeral port
	const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FAS CasePilot Harness</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>FAS CasePilot Harness Ready</h1>
  <p>This is a placeholder dev server for Phase 0. Phase 1 will scaffold Next.js.</p>
  <h2>Commands</h2>
  <ul>
    <li><code>pnpm install</code> — install dependencies</li>
    <li><code>pnpm dev</code> — run this placeholder server</li>
    <li><code>pnpm lint</code> — run eslint</li>
    <li><code>pnpm typecheck</code> — run tsc</li>
    <li><code>pnpm test</code> — run vitest</li>
  </ul>
  <p><strong>Note:</strong> Supabase start is skipped until Phase 1 adds the supabase/ directory.</p>
</body>
</html>`;

	const server = createServer((req, res) => {
		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(html);
	});

	await new Promise((resolve) => {
		server.listen(port, "127.0.0.1", resolve);
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
