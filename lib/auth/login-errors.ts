export const GENERIC_LOGIN_ERROR = "Email or password is incorrect.";
export const GENERIC_LOGIN_HINT = "Check both and try again. After 5 attempts, sign-in pauses for 15 minutes.";
export const RATE_LIMIT_ERROR = "Too many sign-in attempts.";
export const RATE_LIMIT_HINT = "Sign-in is paused for 15 minutes. Try again after that.";
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
