import { describe, expect, it } from "vitest";
import { buildReportInput, pickLockedVersions } from "./report-input";

const manifest = (pkg: Record<string, unknown>) => JSON.stringify(pkg);

const basic = manifest({
  name: "app",
  dependencies: { react: "^19.0.0" },
  devDependencies: { typescript: "^5.0.0" },
});

describe("buildReportInput", () => {
  it("builds the input from package.json alone", () => {
    expect(buildReportInput({ packageJson: basic })).toEqual({
      ok: true,
      value: {
        name: "app",
        dependencies: [
          { name: "react", specifier: "^19.0.0", type: "prod" },
          { name: "typescript", specifier: "^5.0.0", type: "dev" },
        ],
        lockedVersions: null,
        warnings: [],
        packageManager: "npm",
      },
    });
  });

  it("keeps only lockfile entries of direct dependencies", () => {
    const result = buildReportInput({
      packageJson: basic,
      lockfile: {
        ok: true,
        value: {
          react: { version: "19.1.0" },
          "loose-envify": { version: "1.4.0" },
        },
      },
    });

    expect(result.ok && result.value.lockedVersions).toEqual({
      react: { version: "19.1.0" },
    });
  });

  it.each([
    ["too-large", "lockfile-too-large"],
    ["unsupported", "lockfile-unsupported"],
  ] as const)(
    "turns a %s lockfile into a warning and uses ranges",
    (code, warning) => {
      const result = buildReportInput({
        packageJson: basic,
        lockfile: {
          ok: false,
          error:
            code === "too-large"
              ? { code, maxBytes: 10 * 1024 * 1024 }
              : { code },
        },
      });

      expect(result.ok && result.value.lockedVersions).toBeNull();
      expect(result.ok && result.value.warnings).toEqual([warning]);
    },
  );

  it("keeps the workspaces warning before lockfile warnings", () => {
    const result = buildReportInput({
      packageJson: manifest({
        dependencies: { a: "1.0.0" },
        workspaces: ["packages/*"],
      }),
      lockfile: { ok: false, error: { code: "unsupported" } },
    });

    expect(result.ok && result.value.warnings).toEqual([
      "workspaces",
      "lockfile-unsupported",
    ]);
  });

  it("omits the name when package.json has none", () => {
    const result = buildReportInput({
      packageJson: manifest({ dependencies: { a: "1.0.0" } }),
    });

    expect(result.ok && "name" in result.value).toBe(false);
  });

  it("passes manifest errors through", () => {
    expect(
      buildReportInput({ packageJson: manifest({ name: "empty" }) }),
    ).toEqual({ ok: false, error: { code: "no-dependencies" } });
  });

  it("takes the package manager from the packageManager field", () => {
    const result = buildReportInput({
      packageJson: manifest({
        packageManager: "pnpm@9.1.0",
        dependencies: { a: "1.0.0" },
      }),
      repoFiles: ["yarn.lock"],
    });

    expect(result.ok && result.value.packageManager).toBe("pnpm");
  });

  it("takes the package manager from repository files", () => {
    const result = buildReportInput({
      packageJson: basic,
      repoFiles: ["package.json", "yarn.lock"],
    });

    expect(result.ok && result.value.packageManager).toBe("yarn");
  });
});

describe("pickLockedVersions", () => {
  it("keeps only the given names", () => {
    expect(
      pickLockedVersions(
        new Map([
          ["react", { version: "19.1.0" }],
          ["alias", { version: "1.0.0", realName: "real" }],
          ["transitive", { version: "2.0.0" }],
        ]),
        ["react", "alias", "missing"],
      ),
    ).toEqual({
      react: { version: "19.1.0" },
      alias: { version: "1.0.0", realName: "real" },
    });
  });
});
