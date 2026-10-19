import { z } from "zod";
import { detectLockfile, type LockfileFormat } from "./detect-lockfile";
import type { Result } from "./result";

// screens 5.1, spec 9
export const MAX_MANIFEST_BYTES = 1024 * 1024;
export const MAX_DEPENDENCIES = 300;

export type DependencyType = "prod" | "dev";

export type ManifestDependency = {
  name: string;
  specifier: string;
  type: DependencyType;
};

export type ManifestWarning = "workspaces";

export type Manifest = {
  name?: string;
  packageManager?: string;
  dependencies: ManifestDependency[];
  warnings: ManifestWarning[];
};

export type ManifestError =
  | { code: "too-large"; maxBytes: number }
  | { code: "invalid-json"; line?: number }
  | { code: "lockfile"; format: LockfileFormat }
  | { code: "invalid-package-json" }
  | { code: "no-dependencies" }
  | { code: "too-many-dependencies"; max: number };

const dependencyMap = z.record(z.string(), z.string());

const packageJsonSchema = z.object({
  name: z.string().optional(),
  packageManager: z.string().optional(),
  dependencies: dependencyMap.optional(),
  devDependencies: dependencyMap.optional(),
  workspaces: z
    .union([z.array(z.string()), z.object({ packages: z.array(z.string()) })])
    .optional(),
});

export function parseManifest(text: string): Result<Manifest, ManifestError> {
  // Before the size check: real lockfiles are often over 1 MB, and "this is a
  // lockfile" tells the user more than "file is too large".
  const lockfileFormat = detectLockfile(text);
  if (lockfileFormat) {
    return fail({ code: "lockfile", format: lockfileFormat });
  }

  if (new TextEncoder().encode(text).length > MAX_MANIFEST_BYTES) {
    return fail({ code: "too-large", maxBytes: MAX_MANIFEST_BYTES });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const line = jsonErrorLine(error, text);
    return fail(
      line === undefined
        ? { code: "invalid-json" }
        : { code: "invalid-json", line },
    );
  }

  const parsed = packageJsonSchema.safeParse(raw);
  if (!parsed.success) {
    return fail({ code: "invalid-package-json" });
  }
  const pkg = parsed.data;

  const dependencies: ManifestDependency[] = Object.entries(
    pkg.dependencies ?? {},
  ).map(([name, specifier]) => ({ name, specifier, type: "prod" }));
  const prodNames = new Set(dependencies.map((dep) => dep.name));
  for (const [name, specifier] of Object.entries(pkg.devDependencies ?? {})) {
    // npm installs the `dependencies` entry when a package is in both sections.
    if (!prodNames.has(name)) {
      dependencies.push({ name, specifier, type: "dev" });
    }
  }

  if (dependencies.length === 0) {
    return fail({ code: "no-dependencies" });
  }
  if (dependencies.length > MAX_DEPENDENCIES) {
    return fail({ code: "too-many-dependencies", max: MAX_DEPENDENCIES });
  }

  return {
    ok: true,
    value: {
      ...(pkg.name !== undefined && { name: pkg.name }),
      ...(pkg.packageManager !== undefined && {
        packageManager: pkg.packageManager,
      }),
      dependencies,
      warnings: pkg.workspaces ? ["workspaces"] : [],
    },
  };
}

// V8 appends "(line N column M)" to newer messages and "at position N" to
// older ones; other engines may give neither, then the line is omitted.
function jsonErrorLine(error: unknown, text: string): number | undefined {
  if (!(error instanceof SyntaxError)) return undefined;

  const lineMatch = /\(line (\d+) column \d+\)/.exec(error.message);
  if (lineMatch?.[1]) return Number(lineMatch[1]);

  const positionMatch = /at position (\d+)/.exec(error.message);
  if (positionMatch?.[1]) {
    const position = Number(positionMatch[1]);
    return text.slice(0, position).split("\n").length;
  }
  return undefined;
}

function fail(error: ManifestError): Result<Manifest, ManifestError> {
  return { ok: false, error };
}
