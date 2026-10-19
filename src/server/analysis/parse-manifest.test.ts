import { describe, expect, it } from "vitest";
import {
  MAX_DEPENDENCIES,
  MAX_MANIFEST_BYTES,
  parseManifest,
} from "./parse-manifest";

const json = (value: unknown) => JSON.stringify(value, null, 2);

function deps(count: number) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`pkg-${i}`, "^1.0.0"]),
  );
}

describe("parseManifest", () => {
  it("returns prod and dev dependencies with metadata", () => {
    const result = parseManifest(
      json({
        name: "my-app",
        packageManager: "pnpm@9.0.0",
        dependencies: { react: "^19.0.0" },
        devDependencies: { vitest: "~3.1.0" },
        scripts: { build: "next build" },
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        name: "my-app",
        packageManager: "pnpm@9.0.0",
        dependencies: [
          { name: "react", specifier: "^19.0.0", type: "prod" },
          { name: "vitest", specifier: "~3.1.0", type: "dev" },
        ],
        warnings: [],
      },
    });
  });

  it("keeps a package listed in both sections once, as prod", () => {
    const result = parseManifest(
      json({
        dependencies: { lodash: "^4.0.0" },
        devDependencies: { lodash: "^4.17.0", vitest: "^3.0.0" },
      }),
    );

    expect(result.ok && result.value.dependencies).toEqual([
      { name: "lodash", specifier: "^4.0.0", type: "prod" },
      { name: "vitest", specifier: "^3.0.0", type: "dev" },
    ]);
  });

  it("reports invalid JSON with the line number", () => {
    const text = '{\n  "dependencies": {\n    react: "^19.0.0"\n  }\n}';

    expect(parseManifest(text)).toEqual({
      ok: false,
      error: { code: "invalid-json", line: 3 },
    });
  });

  it("reports invalid JSON without a line when it can't be determined", () => {
    expect(parseManifest('{"dependencies":')).toEqual({
      ok: false,
      error: { code: "invalid-json" },
    });
    expect(parseManifest("")).toEqual({
      ok: false,
      error: { code: "invalid-json" },
    });
  });

  it.each([
    ["npm", json({ name: "app", lockfileVersion: 3, packages: {} })],
    ["pnpm", "---\nlockfileVersion: '9.0'\n\nimporters:\n"],
    ["yarn", "# yarn lockfile v1\n\n\nreact@^19.0.0:\n"],
  ] as const)(
    "detects a %s lockfile instead of invalid JSON",
    (format, text) => {
      expect(parseManifest(text)).toEqual({
        ok: false,
        error: { code: "lockfile", format },
      });
    },
  );

  it("reports a lockfile over the size limit as a lockfile", () => {
    const text = `---\nlockfileVersion: '9.0'\n${"x".repeat(MAX_MANIFEST_BYTES)}`;

    expect(parseManifest(text)).toEqual({
      ok: false,
      error: { code: "lockfile", format: "pnpm" },
    });
  });

  it.each([
    ["an array root", []],
    ["a string root", "hello"],
    ["dependencies that is not an object", { dependencies: ["react"] }],
    ["a non-string version", { dependencies: { react: 19 } }],
  ])("rejects %s as an invalid package.json", (_label, value) => {
    expect(parseManifest(json(value))).toEqual({
      ok: false,
      error: { code: "invalid-package-json" },
    });
  });

  it.each([
    ["no dependency fields", { name: "app" }],
    ["empty dependency objects", { dependencies: {}, devDependencies: {} }],
  ])("reports no dependencies for %s", (_label, value) => {
    expect(parseManifest(json(value))).toEqual({
      ok: false,
      error: { code: "no-dependencies" },
    });
  });

  it.each([
    ["array", ["packages/*"]],
    ["object", { packages: ["packages/*"] }],
  ])("warns about workspaces given as %s", (_label, workspaces) => {
    const result = parseManifest(
      json({ workspaces, dependencies: { react: "^19.0.0" } }),
    );

    expect(result.ok && result.value.warnings).toEqual(["workspaces"]);
  });

  it(`accepts ${MAX_DEPENDENCIES} dependencies and rejects one more`, () => {
    const atLimit = parseManifest(
      json({
        dependencies: deps(MAX_DEPENDENCIES - 1),
        devDependencies: { a: "1" },
      }),
    );
    expect(atLimit.ok && atLimit.value.dependencies).toHaveLength(
      MAX_DEPENDENCIES,
    );

    expect(
      parseManifest(json({ dependencies: deps(MAX_DEPENDENCIES + 1) })),
    ).toEqual({
      ok: false,
      error: { code: "too-many-dependencies", max: MAX_DEPENDENCIES },
    });
  });

  it("measures size in UTF-8 bytes, not characters", () => {
    // "ж" is 2 bytes in UTF-8, so the text is under the limit in characters
    // but over it in bytes.
    const padding = "ж".repeat(MAX_MANIFEST_BYTES / 2);
    const text = json({ description: padding, dependencies: { a: "1" } });

    expect(text.length).toBeLessThan(MAX_MANIFEST_BYTES * 1.01);
    expect(parseManifest(text)).toEqual({
      ok: false,
      error: { code: "too-large", maxBytes: MAX_MANIFEST_BYTES },
    });
  });
});
