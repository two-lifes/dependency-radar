import type { PackageAnalysis } from "../analysis/analyze-package";
import type { Vulnerability } from "../analysis/merge-vulnerabilities";
import type { LockedPackage } from "../analysis/parse-lockfile";
import type { ManifestDependency } from "../analysis/parse-manifest";
import type { UncheckedReason } from "../analysis/resolve-versions";
import type { PackageManager } from "../analysis/update-command";
import { computeLag } from "../analysis/version-lag";
import { buildPackageRow, type CheckPackageRow } from "../check/package-row";

const DAY_MS = 24 * 60 * 60 * 1000;
// Clearly past the 12-month "stale" threshold of `packageStatus`.
const STALE_DAYS = 400;

type CheckedSpec = {
  name: string;
  dev?: true;
  current: string;
  latest: string;
  releasedDaysAgo: number;
  deprecated?: string;
  vulnerabilities?: Vulnerability[];
};

type UncheckedSpec = {
  name: string;
  dev?: true;
  specifier: string;
  unchecked: UncheckedReason;
};

type PackageSpec = CheckedSpec | UncheckedSpec;

type ProjectSpec = {
  name: string;
  packageManager: PackageManager;
  createdDaysAgo: number;
  checkedHoursAgo: number;
  packages: PackageSpec[];
};

export type DemoPackage = {
  dependency: ManifestDependency;
  analysis: PackageAnalysis;
  vulnerabilities: Vulnerability[];
};

export type DemoProject = {
  name: string;
  packageManager: PackageManager;
  createdAt: Date;
  checkedAt: Date;
  dependencies: ManifestDependency[];
  lockedVersions: Record<string, LockedPackage>;
  packages: DemoPackage[];
};

// Real advisories, so "↗" links lead to the actual records.
const LODASH_PROTOTYPE_POLLUTION: Vulnerability = {
  ids: ["GHSA-jf85-cpcp-j695", "CVE-2019-10744"],
  primaryId: "GHSA-jf85-cpcp-j695",
  severity: "critical",
  summary: "Prototype Pollution in lodash",
  fixedIn: "4.17.12",
};

const NEXT_MIDDLEWARE_BYPASS: Vulnerability = {
  ids: ["GHSA-f82v-jwr5-mffw", "CVE-2025-29927"],
  primaryId: "GHSA-f82v-jwr5-mffw",
  severity: "critical",
  summary: "Authorization Bypass in Next.js Middleware",
  fixedIn: "14.2.25",
};

const AXIOS_CSRF_TOKEN_LEAK: Vulnerability = {
  ids: ["GHSA-wf5p-g6vw-rhxx", "CVE-2023-45857"],
  primaryId: "GHSA-wf5p-g6vw-rhxx",
  severity: "moderate",
  summary: "Axios Cross-Site Request Forgery Vulnerability",
  fixedIn: "1.6.0",
};

const JQUERY_XSS: Vulnerability = {
  ids: ["GHSA-gxr4-xjj5-5px2", "CVE-2020-11022"],
  primaryId: "GHSA-gxr4-xjj5-5px2",
  severity: "moderate",
  summary: "Potential XSS vulnerability in jQuery",
  fixedIn: "3.5.0",
};

/** screens 7: one project per state the report can be in. */
const PROJECTS: ProjectSpec[] = [
  {
    // Score about 45: major React/Next lag and 2 critical vulnerabilities.
    name: "shop-frontend",
    packageManager: "pnpm",
    createdDaysAgo: 90,
    checkedHoursAgo: 2,
    packages: [
      {
        name: "next",
        current: "14.1.0",
        latest: "16.4.2",
        releasedDaysAgo: 9,
        vulnerabilities: [NEXT_MIDDLEWARE_BYPASS],
      },
      {
        name: "react",
        current: "18.2.0",
        latest: "19.3.1",
        releasedDaysAgo: 30,
      },
      {
        name: "react-dom",
        current: "18.2.0",
        latest: "19.3.1",
        releasedDaysAgo: 30,
      },
      {
        name: "lodash",
        current: "4.17.11",
        latest: "4.17.21",
        releasedDaysAgo: STALE_DAYS + 900,
        vulnerabilities: [LODASH_PROTOTYPE_POLLUTION],
      },
      { name: "zod", current: "4.6.7", latest: "4.6.7", releasedDaysAgo: 12 },
      { name: "clsx", current: "2.1.1", latest: "2.1.1", releasedDaysAgo: 200 },
      {
        name: "lucide-react",
        current: "1.59.0",
        latest: "1.59.0",
        releasedDaysAgo: 4,
      },
      {
        name: "nuqs",
        current: "2.10.2",
        latest: "2.10.2",
        releasedDaysAgo: 20,
      },
      {
        name: "typescript",
        dev: true,
        current: "5.9.3",
        latest: "5.9.3",
        releasedDaysAgo: 90,
      },
      {
        name: "eslint",
        dev: true,
        current: "9.39.5",
        latest: "9.39.5",
        releasedDaysAgo: 14,
      },
      {
        name: "tailwindcss",
        dev: true,
        current: "4.3.3",
        latest: "4.3.3",
        releasedDaysAgo: 18,
      },
      {
        name: "vitest",
        dev: true,
        current: "5.0.5",
        latest: "5.0.5",
        releasedDaysAgo: 25,
      },
    ],
  },
  {
    // Score about 75: mostly minor and patch updates, one moderate vulnerability.
    name: "admin-dashboard",
    packageManager: "npm",
    createdDaysAgo: 75,
    checkedHoursAgo: 26,
    packages: [
      { name: "nuxt", current: "4.1.0", latest: "4.4.2", releasedDaysAgo: 11 },
      { name: "vue", current: "3.5.13", latest: "3.6.4", releasedDaysAgo: 16 },
      {
        name: "vue-router",
        current: "4.5.0",
        latest: "4.6.3",
        releasedDaysAgo: 40,
      },
      { name: "pinia", current: "3.0.1", latest: "3.0.4", releasedDaysAgo: 50 },
      {
        name: "vue-i18n",
        current: "10.0.5",
        latest: "11.1.12",
        releasedDaysAgo: 35,
      },
      {
        name: "axios",
        current: "1.5.1",
        latest: "1.13.2",
        releasedDaysAgo: 21,
        vulnerabilities: [AXIOS_CSRF_TOKEN_LEAK],
      },
      {
        name: "dayjs",
        current: "1.11.13",
        latest: "1.11.19",
        releasedDaysAgo: 70,
      },
      {
        name: "chart.js",
        current: "4.4.1",
        latest: "4.5.1",
        releasedDaysAgo: 120,
      },
      {
        name: "@vueuse/core",
        current: "13.0.0",
        latest: "13.9.0",
        releasedDaysAgo: 33,
      },
      {
        name: "typescript",
        dev: true,
        current: "5.7.2",
        latest: "5.9.3",
        releasedDaysAgo: 90,
      },
      {
        name: "eslint",
        dev: true,
        current: "9.39.1",
        latest: "9.39.5",
        releasedDaysAgo: 14,
      },
      {
        name: "prettier",
        dev: true,
        current: "3.9.8",
        latest: "3.9.10",
        releasedDaysAgo: 8,
      },
      {
        name: "@nuxt/eslint",
        dev: true,
        current: "1.10.0",
        latest: "1.10.0",
        releasedDaysAgo: 60,
      },
    ],
  },
  {
    // Score about 98: nearly everything is current.
    name: "marketing-site",
    packageManager: "pnpm",
    createdDaysAgo: 60,
    checkedHoursAgo: 72,
    packages: [
      {
        name: "astro",
        current: "5.16.1",
        latest: "5.16.4",
        releasedDaysAgo: 6,
      },
      {
        name: "@astrojs/sitemap",
        current: "3.6.0",
        latest: "3.6.0",
        releasedDaysAgo: 45,
      },
      {
        name: "@astrojs/mdx",
        current: "4.3.10",
        latest: "4.3.12",
        releasedDaysAgo: 10,
      },
      {
        name: "sharp",
        current: "0.34.5",
        latest: "0.34.5",
        releasedDaysAgo: 100,
      },
      {
        name: "tailwindcss",
        current: "4.3.2",
        latest: "4.3.3",
        releasedDaysAgo: 18,
      },
      {
        name: "@fontsource/inter",
        current: "5.2.8",
        latest: "5.2.8",
        releasedDaysAgo: 150,
      },
      {
        name: "typescript",
        dev: true,
        current: "5.9.2",
        latest: "5.9.3",
        releasedDaysAgo: 90,
      },
      {
        name: "prettier",
        dev: true,
        current: "3.9.10",
        latest: "3.9.10",
        releasedDaysAgo: 8,
      },
      {
        name: "prettier-plugin-astro",
        dev: true,
        current: "0.14.1",
        latest: "0.14.1",
        releasedDaysAgo: 300,
      },
    ],
  },
  {
    // Deprecated and stale packages; 5 of 20 not checked → "Partial".
    name: "legacy-widget",
    packageManager: "npm",
    createdDaysAgo: 45,
    checkedHoursAgo: 144,
    packages: [
      {
        name: "request",
        current: "2.88.2",
        latest: "2.88.2",
        releasedDaysAgo: STALE_DAYS + 1700,
        deprecated:
          "request has been deprecated, see https://github.com/request/request/issues/3142",
      },
      {
        name: "node-sass",
        dev: true,
        current: "4.14.1",
        latest: "9.0.0",
        releasedDaysAgo: STALE_DAYS + 800,
        deprecated: "Node Sass is no longer supported. Please use `sass`.",
      },
      {
        name: "left-pad",
        current: "1.3.0",
        latest: "1.3.0",
        releasedDaysAgo: STALE_DAYS + 2400,
        deprecated: "use String.prototype.padStart()",
      },
      {
        name: "jquery",
        current: "2.2.4",
        latest: "3.7.1",
        releasedDaysAgo: STALE_DAYS + 400,
        vulnerabilities: [JQUERY_XSS],
      },
      {
        name: "moment",
        current: "2.29.4",
        latest: "2.30.1",
        releasedDaysAgo: STALE_DAYS + 600,
      },
      {
        name: "underscore",
        current: "1.13.6",
        latest: "1.13.7",
        releasedDaysAgo: STALE_DAYS,
      },
      {
        name: "core-js",
        current: "3.45.1",
        latest: "3.46.0",
        releasedDaysAgo: 25,
      },
      {
        name: "handlebars",
        current: "4.7.8",
        latest: "4.7.8",
        releasedDaysAgo: STALE_DAYS + 700,
      },
      { name: "qs", current: "6.14.0", latest: "6.14.0", releasedDaysAgo: 80 },
      {
        name: "webpack",
        dev: true,
        current: "4.47.0",
        latest: "5.102.1",
        releasedDaysAgo: 15,
      },
      {
        name: "babel-loader",
        dev: true,
        current: "8.4.1",
        latest: "10.0.0",
        releasedDaysAgo: 110,
      },
      {
        name: "@babel/core",
        dev: true,
        current: "7.28.4",
        latest: "7.28.5",
        releasedDaysAgo: 20,
      },
      {
        name: "mocha",
        dev: true,
        current: "11.7.4",
        latest: "11.7.4",
        releasedDaysAgo: 40,
      },
      {
        name: "chai",
        dev: true,
        current: "6.2.0",
        latest: "6.2.0",
        releasedDaysAgo: 30,
      },
      {
        name: "sinon",
        dev: true,
        current: "21.0.0",
        latest: "21.0.0",
        releasedDaysAgo: 60,
      },
      // Source failures only: the report counts just these as "couldn't
      // be checked", and screens 7 asks for 5.
      {
        name: "async",
        specifier: "^2.6.4",
        unchecked: "vulnerabilities-unavailable",
      },
      {
        name: "underscore.string",
        specifier: "^3.3.6",
        unchecked: "vulnerabilities-unavailable",
      },
      {
        name: "backbone",
        specifier: "^1.4.1",
        unchecked: "registry-unavailable",
      },
      {
        name: "grunt",
        dev: true,
        specifier: "^1.6.1",
        unchecked: "registry-unavailable",
      },
      {
        name: "bower",
        dev: true,
        specifier: "^1.8.14",
        unchecked: "registry-unavailable",
      },
    ],
  },
];

/** The demo account's projects as of `now` (screens 7). Pure: no I/O. */
export function buildDemoProjects(now: Date): DemoProject[] {
  const ago = (ms: number) => new Date(now.getTime() - ms);
  return PROJECTS.map((project) => {
    const packages = project.packages.map((spec) => toDemoPackage(spec, now));
    return {
      name: project.name,
      packageManager: project.packageManager,
      createdAt: ago(project.createdDaysAgo * DAY_MS),
      checkedAt: ago(project.checkedHoursAgo * 60 * 60 * 1000),
      dependencies: packages.map(({ dependency }) => dependency),
      // "Check again" resolves the same current versions as the seed.
      lockedVersions: Object.fromEntries(
        packages.flatMap(({ dependency, analysis }) =>
          analysis.checked
            ? [[dependency.name, { version: analysis.current }]]
            : [],
        ),
      ),
      packages,
    };
  });
}

export function demoPackageRows(
  project: DemoProject,
  checkId: string,
): CheckPackageRow[] {
  return project.packages.map((pkg) =>
    buildPackageRow({ checkId, checkedAt: project.checkedAt, ...pkg }),
  );
}

function toDemoPackage(spec: PackageSpec, now: Date): DemoPackage {
  const type = spec.dev ? "dev" : "prod";
  if ("unchecked" in spec) {
    return {
      dependency: { name: spec.name, specifier: spec.specifier, type },
      analysis: { checked: false, reason: spec.unchecked },
      vulnerabilities: [],
    };
  }

  const lastReleaseAt = new Date(
    now.getTime() - spec.releasedDaysAgo * DAY_MS,
  ).toISOString();
  return {
    dependency: { name: spec.name, specifier: `^${spec.current}`, type },
    analysis: {
      checked: true,
      registryName: spec.name,
      current: spec.current,
      latest: spec.latest,
      lag: computeLag(spec.current, spec.latest),
      status:
        spec.deprecated !== undefined
          ? "deprecated"
          : spec.releasedDaysAgo >= STALE_DAYS
            ? "stale"
            : "active",
      ...(spec.deprecated !== undefined && {
        deprecationMessage: spec.deprecated,
      }),
      lastReleaseAt,
    },
    vulnerabilities: spec.vulnerabilities ?? [],
  };
}
