import { describe, expect, it } from "vitest";
import { isFromGuestReport } from "./login-paths";
describe("save hint", () => {
  it.each([
    "/r/id/dependencies",
    "/r/id/vulnerabilities?q=react",
    "/?source=github",
    "/r/id/save-more",
  ])("does not promise saving on %s", (path) =>
    expect(isFromGuestReport(path)).toBe(false),
  );
  it.each(["/r/id/save", "/r/id/save?from=login"])(
    "shows for explicit save %s",
    (path) => expect(isFromGuestReport(path)).toBe(true),
  );
});
