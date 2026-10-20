import { describe, expect, it } from "vitest";
import { githubErrorCopy } from "./copy";

describe("githubErrorCopy", () => {
  it.each([
    [25 * 60, "25 minutes"],
    [61, "2 minutes"],
    [60, "1 minute"],
    [0, "1 minute"],
    [undefined, "1 minute"],
  ])("rounds a %j s wait up to %s", (retryAfterSeconds, expected) => {
    expect(
      githubErrorCopy["rate-limited"]({
        code: "rate-limited",
        retryAfterSeconds,
      }),
    ).toBe(`GitHub is rate-limiting us. Try again in ${expected}.`);
  });
});
