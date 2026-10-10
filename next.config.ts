import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is opened at 127.0.0.1. Without this, Next blocks
  // the client runtime and the page cannot hydrate.
  allowedDevOrigins: ["127.0.0.1"],
  // Keep the repo AGENTS.md. Next must not rewrite it on `pnpm dev`.
  agentRules: false,
  experimental: { lightningCssFeatures: { exclude: ["oklab-colors"] } },
};

export default nextConfig;
