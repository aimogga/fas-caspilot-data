export function isDevGalleryEnabled(
  nodeEnv = process.env.NODE_ENV,
  vercelEnv = process.env.VERCEL_ENV,
): boolean {
  if (vercelEnv === "production") return false;
  return nodeEnv !== "production" || vercelEnv === "preview";
}
