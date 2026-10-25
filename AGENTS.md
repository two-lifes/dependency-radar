# Dependency Radar

Web service that analyzes npm dependencies of a JS/TS project: outdated packages, vulnerabilities, breaking changes, upgrade plan.
Product spec (source of truth for behavior): `docs/spec.md`. Stack rationale and architecture decisions: `docs/decisions.md`.
Screens, routes, navigation, UI copy and states (reference for every page you build): `docs/screens.md`. Visuals: `docs/sitemap.png`, `docs/wireframes.png` (sources: `docs/*.excalidraw`). If an image and `docs/screens.md` disagree, `docs/screens.md` wins. Build only routes and elements marked with the current stage.
Visual style: `docs/design/style-guide.md`; tokens: `docs/design/theme.css` (copy into `src/app/globals.css`); look: `docs/design/preview.png`. Use only theme tokens (`bg-card`, `text-muted-foreground`, `text-danger`…), never raw hex colors or arbitrary values in components.

## Stack

- Next.js (App Router) + React, TypeScript `strict`
- Tailwind CSS v4, Radix UI primitives, own components in `src/components/ui`
- Fonts: `geist` package (Geist Sans, Geist Mono); icons: `lucide-react`
- PostgreSQL (Neon) + Drizzle ORM, migrations via drizzle-kit
- Better Auth: GitHub OAuth + email magic link (emails via Resend)
- Zod for all validation (forms, API input, external API responses)
- React Hook Form for forms
- TanStack Table + TanStack Virtual for the dependency table
- nuqs for state in URL search params (filters, sort, search, open package)
- `semver` for version ranges and diffs
- Recharts for charts
- Vitest + Testing Library, MSW for mocking external APIs, Playwright for e2e
- ESLint + Prettier, pnpm
- GitHub Actions CI, Vercel deploy, Vercel Cron for scheduled checks

Do not add dependencies outside this list without asking first and explaining why.

## External data sources

- npm registry: `https://registry.npmjs.org/<name>` — versions, dist-tags, deprecation, repo URL
- OSV.dev: `POST https://api.osv.dev/v1/query` (and `/v1/querybatch`) — vulnerabilities, ecosystem `npm`
- GitHub REST API — releases (changelogs), reading `package.json` / lockfile from public repos. Unauthenticated limit is 60 req/h, so always use `GITHUB_TOKEN` server-side

Rules: all external calls happen on the server only, go through `src/server/sources/*`, validate responses with Zod, are cached in Postgres with a TTL (1 hour by default), run with limited concurrency, and handle rate limits and failures per package (one failed package never fails the whole report).

## Project structure

```
src/
  app/                 routes (App Router), route handlers in app/api
  components/ui/       generic UI components (no business logic)
  components/          feature components
  features/<feature>/  feature-specific components, hooks, server actions
  server/
    db/                Drizzle schema, client, queries
    sources/           npm, osv, github clients
    analysis/          pure logic: version diff, health score, breaking-change detection, upgrade plan
  lib/                 shared utils
tests/e2e/             Playwright
docs/                  spec.md, decisions.md, workflow.md, plan.md
```

Logic in `src/server/analysis` must be pure functions (no I/O) with unit tests.

## Commands

```
pnpm dev          # dev server
pnpm build        # production build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest
pnpm test:e2e     # playwright
pnpm db:generate  # drizzle-kit generate
pnpm db:migrate   # apply migrations
pnpm db:seed      # demo data
```

## Verification cadence and development speed

A **task** is one numbered item in `docs/plan.md`. A **development stage** is one lettered section **A–F** of that plan, not a product version from spec section 11.

- **After a task:** inspect the diff, run ESLint only on changed code files (`pnpm exec eslint <files>`) and run only the relevant new/affected unit or RTL test files (`pnpm exec vitest run <test-files>`). Run `pnpm typecheck` once when TypeScript code or interfaces change. For documentation-only changes, check the diff, links and consistency; do not run application checks.
- **Heavy checks are prohibited after individual tasks.** Full-project lint/test runs, production builds, PostgreSQL integration tests, Playwright/e2e, browser screenshot matrices, performance measurements and real external API checks are reserved for stage completion or a direct user request for those checks. A UI change, a large diff, a commit or a push is not permission to run them.
- **At stage completion:** after implementing the last unfinished task in its A–F section, run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` once, plus the integration/e2e and visual checks relevant to that stage. For UI stages, use Playwright MCP and compare affected screens with `docs/screens.md` and `docs/wireframes.png` in dark/light themes at 1440px/390px; include any additional viewport required by the stage. Do not re-audit unrelated screens.
- Write necessary integration/e2e tests alongside the feature, but defer their execution to the stage gate. Record pending checks or unavailable prerequisites briefly in the corresponding stage of `docs/plan.md`; report them as deferred, never as passed. Deferral does not mean deleting, skipping or weakening tests.
- Do not create databases/containers, install browsers or dependencies, start auxiliary services, or repair the test environment just to finish an individual task. If a necessary focused check cannot run, report the exact blocker; do not silently expand into environment setup or heavy verification. Existing approval requirements for migrations and destructive actions still apply at stage gates.
- Read only task-relevant documentation and code. Reuse findings and documentation already verified in the session. Keep the diff within the approved task; report unrelated issues without fixing them.
- Stop after the necessary focused checks pass. Repeat a check only after a relevant code change or to verify a concrete fix to its failure. Do not repeat successful checks for a final summary, documentation edits, a commit or a push. Reuse applicable CI results instead of duplicating them locally; CI configuration is unchanged.
- Use the existing tools and test setup. If a short validation turns into infrastructure work, stop that detour and state what remains unverified. No speculative audits, extra screenshots or additional coverage unrelated to the task's acceptance criteria.

This cadence replaces earlier per-task full-suite and per-UI screenshot requirements, including historical instructions in task descriptions. `docs/workflow.md` and the `next-task` skill follow this section.

## Code conventions

- Server Components by default; `"use client"` only where interactivity is needed
- Mutations via Server Actions; route handlers only for streaming progress (SSE), cron and webhooks
- No `any`, no `@ts-ignore`, no non-null `!` without a comment explaining why
- Named exports; file names in kebab-case; components in PascalCase
- Every screen implements loading (skeleton), empty, error (with retry) and partial states (spec, section 8)
- Accessibility: semantic HTML, keyboard support, visible focus, labels for inputs, `prefers-reduced-motion`
- UI text in English, kept in one place per feature so it can be translated later
- Secrets only in env variables; `.env.example` lists every variable with no values
- `notFound()` before streaming (real 404) makes Next send an error shell (`<html id="__next_error__">`) and render the root layout on the client, so inline `<head>` scripts don't run. Anything the theme script does must also be covered by `ThemeScriptFallback`; include 404s in the stage's theme checks when theme/error-shell behavior changes.

## How to work in this repo

1. Work stage by stage per `docs/spec.md` section 11. Do not build features from a later stage.
2. Before any non-trivial feature: propose a short plan (files, data flow, edge cases) and wait for approval.
3. If the spec is ambiguous, ask instead of guessing. Never edit `docs/spec.md` yourself.
4. Small focused commits, Conventional Commits format (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`).
5. New logic comes with tests. Bug fixes come with a test reproducing the bug.
6. When making an architectural choice (library, data model, caching, approach), add an entry to `docs/decisions.md`: context, options, choice, why.
7. Explain non-obvious code in the summary after each task so the author can review and defend it.
8. Follow the verification cadence above. Implement UI against the relevant screen requirements during the task; run the browser and screenshot review only at its A–F stage gate or when directly requested.
