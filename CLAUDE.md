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
docs/                  spec.md, decisions.md
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

Before declaring a task done, run: `pnpm lint && pnpm typecheck && pnpm test`.

## Code conventions

- Server Components by default; `"use client"` only where interactivity is needed
- Mutations via Server Actions; route handlers only for streaming progress (SSE), cron and webhooks
- No `any`, no `@ts-ignore`, no non-null `!` without a comment explaining why
- Named exports; file names in kebab-case; components in PascalCase
- Every screen implements loading (skeleton), empty, error (with retry) and partial states (spec, section 8)
- Accessibility: semantic HTML, keyboard support, visible focus, labels for inputs, `prefers-reduced-motion`
- UI text in English, kept in one place per feature so it can be translated later
- Secrets only in env variables; `.env.example` lists every variable with no values

## How to work in this repo

1. Work stage by stage per `docs/spec.md` section 11. Do not build features from a later stage.
2. Before any non-trivial feature: propose a short plan (files, data flow, edge cases) and wait for approval.
3. If the spec is ambiguous, ask instead of guessing. Never edit `docs/spec.md` yourself.
4. Small focused commits, Conventional Commits format (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`).
5. New logic comes with tests. Bug fixes come with a test reproducing the bug.
6. When making an architectural choice (library, data model, caching, approach), add an entry to `docs/decisions.md`: context, options, choice, why.
7. Explain non-obvious code in the summary after each task so the author can review and defend it.
