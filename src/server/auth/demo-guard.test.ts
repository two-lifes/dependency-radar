import { describe, expect, it } from "vitest";
import { isDemoAuthPathAllowed } from "./demo-guard";

describe("isDemoAuthPathAllowed", () => {
  it.each([
    "/get-session",
    "/sign-out",
    "/sign-in/magic-link",
    "/sign-in/social",
    "/magic-link/verify",
    "/callback/github",
    undefined,
  ])("lets the demo call %s", (path) => {
    expect(isDemoAuthPathAllowed(path)).toBe(true);
  });

  it.each([
    "/update-user",
    "/delete-user",
    "/list-sessions",
    "/revoke-session",
    "/revoke-sessions",
    "/revoke-other-sessions",
    "/link-social",
    "/unlink-account",
    "/change-email",
    "/list-accounts",
    "/sign-in",
    "/some-future-endpoint",
  ])("stops the demo calling %s", (path) => {
    expect(isDemoAuthPathAllowed(path)).toBe(false);
  });
});
