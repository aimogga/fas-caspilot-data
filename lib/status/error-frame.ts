import type { UserRole } from "@/lib/auth/role-guards";

export type ErrorViewer = { signedIn: boolean; role: UserRole | null; email: string | null };

export const SIGNED_OUT_VIEWER: ErrorViewer = { signedIn: false, role: null, email: null };
export const ERROR_VIEWER_TIMEOUT_MS = 4000;

export function shellDisplayName(email: string | null): string {
  return email ?? "Signed in";
}

export async function resolveErrorViewer(
  load: () => Promise<ErrorViewer>,
  timeoutMs = ERROR_VIEWER_TIMEOUT_MS,
): Promise<ErrorViewer> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      load(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
  } catch {
    return SIGNED_OUT_VIEWER;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
