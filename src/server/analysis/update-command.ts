import type { DependencyType } from "./parse-manifest";

export type PackageManager = "npm" | "pnpm" | "yarn";

export type UpdateTarget = {
  /** Name in package.json: the alias name for `npm:` aliases. */
  name: string;
  registryName: string;
  version: string;
  type: DependencyType;
};

const INSTALL: Record<PackageManager, string> = {
  npm: "npm i",
  pnpm: "pnpm add",
  yarn: "yarn add",
};

/** spec 7.5: dev dependencies go into a separate command with `-D`. */
export function updateCommands(
  manager: PackageManager,
  targets: readonly UpdateTarget[],
): string[] {
  const unique = [
    ...new Map(targets.map((target) => [target.name, target])).values(),
  ];
  const groups: [DependencyType, string][] = [
    ["prod", INSTALL[manager]],
    ["dev", `${INSTALL[manager]} -D`],
  ];
  return groups.flatMap(([type, command]) => {
    const specs = unique
      .filter((target) => target.type === type)
      .map(installSpec);
    return specs.length > 0 ? [`${command} ${specs.join(" ")}`] : [];
  });
}

// An alias stays an alias, otherwise the install would rename the dependency.
function installSpec(target: UpdateTarget): string {
  return target.name === target.registryName
    ? `${target.name}@${target.version}`
    : `${target.name}@npm:${target.registryName}@${target.version}`;
}
