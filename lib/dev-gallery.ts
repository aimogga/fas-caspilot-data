export function isDevGalleryEnabled(nodeEnv = process.env.NODE_ENV, vercelEnv = process.env.VERCEL_ENV): boolean {
  return vercelEnv !== "production" && (nodeEnv !== "production" || vercelEnv === "preview");
}
