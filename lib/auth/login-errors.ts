export const GENERIC_LOGIN_ERROR = "Email or password is incorrect.";
export const GENERIC_LOGIN_HINT = "Check both and try again.";
export const RATE_LIMIT_ERROR = "Too many attempts.";
export const RATE_LIMIT_HINT = "Wait a few minutes and try again.";
export const UNAVAILABLE_ERROR = "Sign-in is temporarily unavailable.";

export type LoginError = { title: string; hint: string };

type AuthLikeError = { status?: number; code?: string; message?: string } | null | undefined;

export function mapLoginError(error: AuthLikeError): LoginError {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();
  if (error?.status === 429 || code.includes("rate_limit") || message.includes("rate limit")) {
    return { title: RATE_LIMIT_ERROR, hint: RATE_LIMIT_HINT };
  }
  return { title: GENERIC_LOGIN_ERROR, hint: GENERIC_LOGIN_HINT };
}
