# Default locale URL verification

Verified locally on 2026-09-11 for Issue #24.

The site's default language now uses public URLs without a locale prefix. Internal rewrites retain the original browser URL and Next.js origin. Explicit default-language prefixes redirect with HTTP 301, preserving query strings. Other languages retain their prefixes. Browser language preferences and locale cookies do not override the site default.

Navigation, canonical URLs and hreflang use the same per-site rule. `x-default` is emitted only when a default-language translation exists. Tests also cover a site with English as its default language, avoiding a hardcoded Vietnamese policy.

| Check | Result |
| --- | --- |
| Workspace lint and typecheck | Passed |
| API and web production builds | Passed |
| API unit tests | 18 passed (Turbo cache) |
| Web unit tests | 40 passed |
| Real PostgreSQL integration tests | 25 passed |
| Production Playwright tests, desktop and mobile | 28 passed |
| Total test cases | **111 passed** |

Browser tests verify root and unprefixed About pages render directly, legacy URLs redirect once, translated navigation works in both directions, metadata matches public URLs, and tenant isolation and real 404 responses remain intact.

The first production browser run caught an internal rewrite accidentally using the public hostname as its origin, causing Next.js to proxy externally on local domains. This was corrected and a dedicated middleware regression test was added before the successful rerun.

Local runtime: Node 24.10.0, pnpm 9.15.9, PostgreSQL 16.15, API port 4001. See `phase-0-verification.md` for the original Phase 0 validation and host limitations. Its earlier `/vi` Lighthouse measurement predates this URL policy update; Lighthouse was not rerun for this change.
