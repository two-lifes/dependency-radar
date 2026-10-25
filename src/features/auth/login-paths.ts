import { DEFAULT_NEXT } from "@/lib/safe-next";

export type LoginError = "github" | "link-expired";

/**
 * `/login` with an error banner, keeping where the user was going. Not
 * `?error=`: Better Auth sets that itself on the error callback URL and would
 * overwrite ours.
 */
export function loginErrorPath(reason: LoginError, next: string): string {
  const params = new URLSearchParams({ reason });
  if (next !== DEFAULT_NEXT) params.set("next", next);
  return `/login?${params}`;
}

export function checkEmailPath(email: string, next: string): string {
  const params = new URLSearchParams({ email });
  if (next !== DEFAULT_NEXT) params.set("next", next);
  return `/login/check-email?${params}`;
}

/** screens 5.2: the save hint shows when sign-in started from a guest report. */
export function isFromGuestReport(next: string): boolean {
  return /^\/r\/[^/?]+\/save(?:\?|$)/.test(next);
}
