import { describe, expect, it } from "vitest";
import { MAX_LOCKFILE_BYTES, parseLockfile } from "./parse-lockfile";

const lockfile = (lockfileVersion: number, packages: Record<string, unknown>) =>
  JSON.stringify({ name: "app", lockfileVersion, packages });

describe("parseLockfile", () => {
  it.each([2, 3])("reads top-level packages from v%i", (version) => {
    const result = parseLockfile(
      lockfile(version, {
        "": { name: "app", dependencies: { react: "^19.0.0" } },
        "node_modules/react": { version: "19.1.0" },
        "node_modules/@types/node": { version: "22.5.1", dev: true },
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: new Map([
        ["react", { version: "19.1.0" }],
        ["@types/node", { version: "22.5.1" }],
      ]),
    });
  });

  it("ignores nested node_modules entries", () => {
    const result = parseLockfile(
      lockfile(3, {
        "node_modules/a": { version: "1.0.0" },
        "node_modules/a/node_modules/b": { version: "2.0.0" },
        "node_modules/@scope/c/node_modules/d": { version: "3.0.0" },
      }),
    );

    expect(result.ok && [...result.value.keys()]).toEqual(["a"]);
  });

  it("skips workspace links", () => {
    const result = parseLockfile(
      lockfile(3, {
        "node_modules/ui": { resolved: "packages/ui", link: true },
        "node_modules/react": { version: "19.1.0" },
      }),
    );

    expect(result.ok && [...result.value.keys()]).toEqual(["react"]);
  });

  it("keeps the real name of an npm: alias", () => {
    const result = parseLockfile(
      lockfile(3, {
        "node_modules/my-lodash": { name: "lodash", version: "4.17.21" },
      }),
    );

    expect(result.ok && result.value.get("my-lodash")).toEqual({
      version: "4.17.21",
      realName: "lodash",
    });
  });

  it("rejects lockfile v1", () => {
    const text = JSON.stringify({
      lockfileVersion: 1,
      dependencies: { react: { version: "16.0.0" } },
    });

    expect(parseLockfile(text)).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
  });

  it.each([
    ["invalid JSON", "{ nope"],
    ["missing packages", JSON.stringify({ lockfileVersion: 3 })],
    ["a non-string version", lockfile(3, { "node_modules/a": { version: 1 } })],
  ])("rejects %s", (_label, text) => {
    expect(parseLockfile(text)).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
  });

  it("rejects files over the size limit", () => {
    const text = lockfile(3, {
      "": { description: "x".repeat(MAX_LOCKFILE_BYTES) },
    });

    expect(parseLockfile(text)).toEqual({
      ok: false,
      error: { code: "too-large", maxBytes: MAX_LOCKFILE_BYTES },
    });
  });
});
