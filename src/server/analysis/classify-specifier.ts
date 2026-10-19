import semver from "semver";

export type RegistrySpecifier =
  { kind: "range"; range: string } | { kind: "tag"; tag: string };

export type SpecifierKind =
  | RegistrySpecifier
  | { kind: "alias"; name: string; inner: RegistrySpecifier }
  | { kind: "non-registry" }
  | { kind: "invalid" };

// spec 7.4: these are never looked up in the npm registry.
const NON_REGISTRY_PREFIXES = [
  "git+",
  "git:",
  "github:",
  "gitlab:",
  "bitbucket:",
  "file:",
  "link:",
  "workspace:",
  "portal:",
  "patch:",
  "catalog:",
  "http:",
  "https:",
  "./",
  "../",
  "/",
  "~/",
];

// npm's `owner/repo` and `owner/repo#ref` GitHub shorthand.
const GITHUB_SHORTHAND = /^[\w.-]+\/[\w.-]+(#.*)?$/;

// npm rejects tags that need URL encoding; valid ranges are checked first.
const TAG = /^[A-Za-z0-9][\w.-]*$/;

const ALIAS = /^npm:((?:@[^/@]+\/)?[^/@]+)(?:@(.*))?$/;

export function classifySpecifier(specifier: string): SpecifierKind {
  const spec = specifier.trim();

  if (spec.startsWith("npm:")) {
    const match = ALIAS.exec(spec);
    const name = match?.[1];
    if (!name) return { kind: "invalid" };

    const inner = classifyRegistry(match[2] ?? "*");
    return inner ? { kind: "alias", name, inner } : { kind: "invalid" };
  }

  if (NON_REGISTRY_PREFIXES.some((prefix) => spec.startsWith(prefix))) {
    return { kind: "non-registry" };
  }
  if (GITHUB_SHORTHAND.test(spec)) {
    return { kind: "non-registry" };
  }

  return classifyRegistry(spec) ?? { kind: "invalid" };
}

function classifyRegistry(spec: string): RegistrySpecifier | undefined {
  if (semver.validRange(spec) !== null) return { kind: "range", range: spec };
  if (TAG.test(spec)) return { kind: "tag", tag: spec };
  return undefined;
}
