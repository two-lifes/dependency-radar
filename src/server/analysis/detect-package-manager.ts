import type { PackageManager } from "./update-command";

const MANAGERS: readonly PackageManager[] = ["npm", "pnpm", "yarn"];

/**
 * spec 7.5: the `packageManager` field (`pnpm@9.1.0`) → a pnpm or yarn
 * lockfile in the repository root → npm. An unsupported manager in the field
 * (`bun@1.1.0`) falls through to the lockfiles. pnpm wins over yarn when both
 * lockfiles exist, following the order in the spec.
 */
export function detectPackageManager(input: {
  packageManager?: string;
  files?: readonly string[];
}): PackageManager {
  const fromField = input.packageManager?.trim().split("@")[0];
  const manager = MANAGERS.find((m) => m === fromField);
  if (manager) return manager;

  const files = input.files ?? [];
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  return "npm";
}
