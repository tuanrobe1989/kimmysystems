# Phase 0 verification

Tested on 2026-09-11. Scope: T0.1–T0.7 in `phase-0-local.md`.

## Automated checks

| Check | Result |
| --- | --- |
| Frozen pnpm install and Prisma generation | Pass |
| ESLint, TypeScript, production builds | Pass for API and web |
| Playwright configuration/test TypeScript | Pass |
| API unit tests | 18 passed |
| Web routing, host-cache and middleware unit tests | 31 passed |
| PostgreSQL API integration tests | 25 passed |
| Chromium desktop/mobile browser tests | 24 passed |
| Total automated test cases | **98 passed** |

The complete CI run on Node 22/Linux also passed: [GitHub Actions run 34561065178](https://github.com/tuanrobe1989/kimmysystems/actions/runs/34561065178). It ran the actual Docker Compose stack, checked PostgreSQL/Redis/MinIO/Mailpit health, applied migrations, seeded twice, built both apps, and ran the unit, database and browser suites. Subsequent PR/main runs repeat these checks on the merged state.

Local runtime: Node 24.10.0, pnpm 9.15.9, PostgreSQL 16.15. Browser tests used production builds. Unit tests use mocks only where appropriate to exercise routing/cache failures; integration tests use a real PostgreSQL database and real Nest HTTP application.

## Behavior covered

- Kimmy Home and About read vi/en content from the database through the API. Language switching on About preserves the corresponding slug (`gioi-thieu` / `about`) and updates document language.
- Demo serves distinct content on its own hostname. Its missing English translation is a real 404 and is excluded from language navigation/hreflang.
- Unknown domain, invalid locale and missing page return HTTP 404. Registered but unsupported locale uses the page-not-found view; unregistered domains use a separate domain-not-found view.
- Titles, descriptions, canonical URLs and alternate translated slugs match actual content and domains.
- Two consecutive seeds preserve row counts and site IDs: 2 sites, 3 domain aliases, 3 pages, 5 translations.
- Duplicate slugs within the same site/locale and cross-site translation foreign keys are rejected by PostgreSQL. Identical slugs in different sites are allowed and isolated.
- Draft, future-published and undated published pages are hidden from public reads.
- Missing/malformed domains, IDs, slugs and locales are rejected. Caller-provided tenant and forwarded-host headers cannot select another site's content.
- Concurrent requests alternate between the two tenants without contaminating cached output.
- Host cache expires after 60 seconds, caps its size, caches unknown sites and does not cache upstream failures as missing sites.
- Mobile and desktop light/dark screenshots were inspected; viewport-overflow checks passed. Browser navigation and language controls work in both viewport profiles.

## Additional runtime checks

- Stopped the local API, sent an uncached hostname request, verified HTTP **503**, `Cache-Control: no-store`, `Retry-After: 5`; restarted the API and verified the unknown domain returned **404** again.
- Launched the compiled API with an empty `S3_SECRET`: startup failed with exit code 1 and named the invalid field without printing its value.
- Lighthouse against local production `/vi`, mobile simulation: **Performance 99, Accessibility 100, Best Practices 100, SEO 100**. This is a local lab measurement, not production Core Web Vitals. The audit completed through a Playwright-managed Chromium session.

## Host limitations and operational notes

- Windows currently reports virtualization unavailable, and Docker Desktop's Linux engine is unavailable. Docker execution was validated on GitHub Actions; it has **not** been made operational on this Windows host.
- A vendor PostgreSQL portable build under `.local/` supports real local API/web testing. Redis, MinIO and Mailpit are not running locally. Phase 0 app reads require PostgreSQL only.
- LocalWP occupies port 4000. This machine's ignored `.env` files use API port **4001**. Default examples and CI remain on 4000.
- No application production/staging deployment was performed. Data caching uses `revalidate: 60`; host-aware HTML remains SSR, not full-page ISR.
- Branch `main` requires PRs, an up-to-date successful `verify` check, linear history and resolved conversations, including administrators. Only squash merge is enabled; head branches are configured for automatic deletion.

The code is delivered through PRs [#8](https://github.com/tuanrobe1989/kimmysystems/pull/8), [#9](https://github.com/tuanrobe1989/kimmysystems/pull/9), [#10](https://github.com/tuanrobe1989/kimmysystems/pull/10), [#11](https://github.com/tuanrobe1989/kimmysystems/pull/11), [#12](https://github.com/tuanrobe1989/kimmysystems/pull/12), [#13](https://github.com/tuanrobe1989/kimmysystems/pull/13), [#14](https://github.com/tuanrobe1989/kimmysystems/pull/14), associated with Issues #1–#7.
