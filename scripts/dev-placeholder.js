#!/usr/bin/env node

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

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
    <li><code>pnpm lint</code> — run biome</li>
    <li><code>pnpm typecheck</code> — run tsc</li>
    <li><code>pnpm test</code> — run node --test</li>
  </ul>
  <p><strong>Note:</strong> Supabase start is skipped until Phase 1 adds the supabase/ directory.</p>
</body>
</html>`;

export function createHarnessServer() {
	return createServer((req, res) => {
		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(html);
	});
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const PORT = Number.parseInt(process.env.PORT || "3000", 10);
	const server = createHarnessServer();
	server.listen(PORT, "0.0.0.0", () => {
		console.log(`Harness placeholder running on http://0.0.0.0:${PORT}`);
		console.log("Phase 1 will replace this with Next.js.");
	});
}
