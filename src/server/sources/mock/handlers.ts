import { delay } from "msw";
import { http, HttpResponse } from "msw/http";
import semver from "semver";
import { z } from "zod";
import type { OsvRecord } from "../../analysis/osv-record";
import { NPM_REGISTRY_URL } from "../npm";
import { OSV_API_URL } from "../osv";

// Fake npm and OSV for `MOCK_EXTERNAL=1` (dev, e2e): the sample project from
// the landing gets every kind of finding, and results arrive slowly enough to
// watch the report fill in. A package named `fail-*` gets a 503, which makes
// the check partial (or failed if it is the only one).

type MockPackage = {
  /** Version → publish date. */
  versions: Record<string, string>;
  latest: string;
  deprecated?: string;
};

const PACKAGES: Record<string, MockPackage> = {
  next: {
    versions: {
      "14.2.3": "2024-04-24",
      "14.2.35": "2025-12-11",
      "15.5.4": "2025-09-19",
      "16.0.1": "2026-10-01",
    },
    latest: "16.0.1",
  },
  react: {
    versions: {
      "18.2.0": "2022-06-14",
      "18.3.1": "2024-04-26",
      "19.2.0": "2026-09-01",
    },
    latest: "19.2.0",
  },
  "react-dom": {
    versions: {
      "18.2.0": "2022-06-14",
      "18.3.1": "2024-04-26",
      "19.2.0": "2026-09-01",
    },
    latest: "19.2.0",
  },
  axios: {
    versions: {
      "0.21.1": "2020-12-22",
      "0.21.4": "2021-09-06",
      "1.12.2": "2026-09-14",
    },
    latest: "1.12.2",
  },
  lodash: {
    versions: { "4.17.20": "2020-08-13", "4.17.21": "2021-02-20" },
    latest: "4.17.21",
  },
  moment: {
    versions: {
      "2.29.1": "2020-10-06",
      "2.29.4": "2022-07-06",
      "2.30.1": "2023-12-27",
    },
    latest: "2.30.1",
  },
  request: {
    versions: { "2.88.2": "2020-02-11" },
    latest: "2.88.2",
    deprecated: "request has been deprecated",
  },
  zod: {
    versions: {
      "3.22.4": "2023-10-03",
      "3.25.76": "2025-07-08",
      "4.1.12": "2026-10-08",
    },
    latest: "4.1.12",
  },
  "@types/react": {
    versions: {
      "18.2.0": "2023-04-20",
      "18.3.26": "2025-10-01",
      "19.2.2": "2026-10-07",
    },
    latest: "19.2.2",
  },
  eslint: {
    versions: {
      "8.57.0": "2024-02-23",
      "8.57.1": "2024-09-20",
      "9.38.0": "2026-10-03",
    },
    latest: "9.38.0",
  },
  typescript: {
    versions: { "5.4.5": "2024-04-10", "5.9.3": "2026-10-01" },
    latest: "5.9.3",
  },
};

const GENERIC: MockPackage = {
  versions: {
    "1.0.0": "2025-01-10",
    "1.1.0": "2025-06-10",
    "2.0.0": "2026-09-10",
  },
  latest: "2.0.0",
};

const VULNERABILITIES: (OsvRecord & { package: string; fixed?: string })[] = [
  {
    id: "GHSA-mock-next-0001",
    aliases: ["CVE-2026-0001"],
    summary: "Mock: authorization bypass in middleware",
    database_specific: { severity: "CRITICAL" },
    package: "next",
    fixed: "14.2.36",
  },
  {
    id: "GHSA-mock-axio-0001",
    summary: "Mock: SSRF via absolute URLs",
    // Real OSV details quote long URLs with no break opportunity (no spaces
    // or hyphens); the package card must wrap them instead of scrolling
    // sideways (e2e package-card).
    details:
      "Absolute URLs bypass baseURL. Fixed in https://github.com/axios/axios/commit/fb8eec214ce7744b5ca787f2c3b8339b2f54b00f",
    database_specific: { severity: "MODERATE" },
    package: "axios",
    fixed: "1.8.2",
  },
  {
    id: "GHSA-mock-requ-0001",
    summary: "Mock: server-side request forgery on redirects",
    database_specific: { severity: "HIGH" },
    package: "request",
  },
];

function osvRecord({
  package: name,
  fixed,
  ...record
}: (typeof VULNERABILITIES)[number]): OsvRecord {
  return {
    ...record,
    affected: [
      {
        package: { ecosystem: "npm", name },
        ranges: [
          {
            type: "SEMVER",
            events: [{ introduced: "0" }, ...(fixed ? [{ fixed }] : [])],
          },
        ],
      },
    ],
  };
}

function isAffected(name: string, version: string) {
  return VULNERABILITIES.filter(
    (vuln) =>
      vuln.package === name &&
      (vuln.fixed === undefined || semver.lt(version, vuln.fixed)),
  );
}

/** Spread so a dozen packages take a few seconds, not all at once. */
const slow = () => {
  const base = Number(process.env.MOCK_EXTERNAL_DELAY_MS ?? 1500);
  return delay(base / 2 + Math.random() * base);
};

const batchSchema = z.object({
  queries: z.array(
    z.object({
      package: z.object({ name: z.string() }),
      version: z.string(),
    }),
  ),
});

export const mockHandlers = [
  http.get(`${NPM_REGISTRY_URL}/*`, async ({ request }) => {
    const name = decodeURIComponent(new URL(request.url).pathname.slice(1));
    await slow();
    if (name.startsWith("fail-")) {
      return new HttpResponse(null, { status: 503 });
    }
    const pkg = PACKAGES[name] ?? GENERIC;
    return HttpResponse.json({
      name,
      description: `Mock package ${name}`,
      "dist-tags": { latest: pkg.latest },
      versions: Object.fromEntries(
        Object.keys(pkg.versions).map((version) => [
          version,
          {
            name,
            version,
            ...(version === pkg.latest && pkg.deprecated
              ? { deprecated: pkg.deprecated }
              : {}),
          },
        ]),
      ),
      time: Object.fromEntries(
        Object.entries(pkg.versions).map(([version, date]) => [
          version,
          `${date}T12:00:00.000Z`,
        ]),
      ),
      license: "MIT",
      repository: {
        type: "git",
        url: `git+https://github.com/mock/${name}.git`,
      },
    });
  }),

  http.post(`${OSV_API_URL}/querybatch`, async ({ request }) => {
    const body = batchSchema.safeParse(await request.json());
    if (!body.success) return new HttpResponse(null, { status: 400 });
    await delay(200);
    return HttpResponse.json({
      results: body.data.queries.map(({ package: { name }, version }) => ({
        vulns: isAffected(name, version).map(({ id }) => ({ id })),
      })),
    });
  }),

  http.get(`${OSV_API_URL}/vulns/:id`, ({ params }) => {
    const vuln = VULNERABILITIES.find(({ id }) => id === params.id);
    return vuln
      ? HttpResponse.json(osvRecord(vuln))
      : new HttpResponse(null, { status: 404 });
  }),
];
