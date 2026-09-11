# Kimmy Systems — System Design & Implementation Plan

> Nền tảng web đa ngôn ngữ, đa website, một database phục vụ cả web lẫn mobile (Flutter), tối ưu SEO/AEO/GEO, CI/CD tự động bằng Docker.
> Ngày lập: 2026-09-11

---

## 1. Mục tiêu & yêu cầu

| Yêu cầu | Diễn giải |
|---|---|
| Đa ngôn ngữ (i18n) | Mỗi site nhiều locale (vi, en, …), URL riêng từng locale, hreflang chuẩn |
| Đa website (multi-site) | Một codebase + một DB phục vụ nhiều domain/brand, cấu hình theo site |
| Một DB cho nhiều app | API-first: web, Flutter mobile, app tương lai đều dùng chung API + PostgreSQL |
| Nhanh & mạnh | SSR/ISR + CDN + Redis cache, Core Web Vitals xanh |
| SEO / AEO / GEO | Schema.org JSON-LD, sitemap/hreflang, llms.txt, nội dung trả lời trực tiếp (answer-ready) |
| API chuẩn | REST + OpenAPI 3.1, versioning, cursor pagination, idempotency, webhooks |
| CI/CD Docker | GitHub Actions → Docker image → tự động deploy staging/prod |
| Bảo mật & Auth | OAuth2/OIDC, JWT + refresh rotation, RBAC, 2FA, OWASP |

## 2. Quyết định công nghệ (và lý do)

| Layer | Chọn | Lý do |
|---|---|---|
| Frontend web | **Next.js 15 (App Router)** | SSR/ISR/RSC tốt nhất cho SEO; Metadata API; edge middleware cho multi-site |
| Backend API | **NestJS (TypeScript)** | Cùng ngôn ngữ với web → share types/validation qua monorepo; module hóa, DI, Swagger tự sinh OpenAPI. *Python (FastAPI) chỉ thêm sau này cho AI/ML service riêng — không nên tách 2 ngôn ngữ ngay từ đầu.* |
| Database | **PostgreSQL 16+** | JSONB, full-text, RLS; 1 nguồn dữ liệu duy nhất |
| ORM | **Prisma** | Schema-first, migrate an toàn, typegen chia sẻ cho cả API |
| Cache / Queue | **Redis + BullMQ** | Cache, rate-limit, job nền (email, revalidate, webhook) |
| File storage | **S3-compatible** (Cloudflare R2 / MinIO) | Ảnh, media; CDN hóa |
| Search (tùy chọn) | Meilisearch | Tìm kiếm đa ngôn ngữ, typo-tolerant |
| Mobile | **Flutter** | Dùng chung API; sinh Dart client từ OpenAPI (openapi-generator) |
| Monorepo | **Turborepo + pnpm** | Share `packages/types`, `packages/config`; build cache |
| Reverse proxy | **Traefik** | Auto SSL (Let's Encrypt), route theo domain cho multi-site |
| CDN / WAF | **Cloudflare** | Cache tĩnh, chống DDoS, WAF miễn phí |

## 3. Kiến trúc tổng thể

```
                        ┌──────────── Cloudflare (CDN + WAF + DNS) ────────────┐
                        │                                                      │
   site-a.com  site-b.com  …                                        app mobile (Flutter)
        │           │                                                          │
        ▼           ▼                                                          │
┌──────────────────────────┐        ┌────────────────────────┐                 │
│  Next.js (web)           │  REST  │  NestJS API  /api/v1   │◄────────────────┘
│  - middleware đọc Host   │───────►│  - OpenAPI 3.1/Swagger │
│    → resolve site config │        │  - Auth (JWT/OIDC)     │
│  - ISR + on-demand       │        │  - RBAC, rate-limit    │
│    revalidation          │        │  - Webhooks, BullMQ    │
└──────────────────────────┘        └───────────┬────────────┘
                                                │
                              ┌─────────────────┼──────────────────┐
                              ▼                 ▼                  ▼
                        PostgreSQL 16      Redis (cache,      S3/R2 (media)
                        (Prisma)           queue, ratelimit)
```

**Nguyên tắc:** Web KHÔNG truy cập DB trực tiếp — mọi dữ liệu đi qua API. Nhờ đó Flutter và mọi app sau này dùng đúng một hợp đồng OpenAPI.

## 4. Cấu trúc monorepo

```
kimmy-systems/
├─ apps/
│  ├─ web/            # Next.js — frontend đa site, đa ngôn ngữ
│  ├─ api/            # NestJS — REST API + Swagger
│  └─ admin/          # (Phase 3) Next.js admin dashboard
├─ packages/
│  ├─ types/          # DTO/type chia sẻ (sinh từ OpenAPI hoặc zod schemas)
│  ├─ config/         # eslint, tsconfig, tailwind preset dùng chung
│  └─ ui/             # component library dùng chung web + admin
├─ infra/
│  ├─ docker/         # Dockerfile per app (multi-stage)
│  ├─ compose/        # docker-compose.{dev,staging,prod}.yml + traefik
│  └─ migrations-job/ # chạy prisma migrate deploy khi deploy
├─ .github/workflows/ # ci.yml, deploy-staging.yml, deploy-prod.yml
└─ turbo.json / pnpm-workspace.yaml
```

## 5. Multi-site & đa ngôn ngữ

### 5.1 Multi-site (một app, nhiều domain)

- Bảng `sites`: `id, domain, default_locale, locales[], theme, settings(jsonb)`.
- Next.js `middleware.ts` đọc `Host` header → lookup site config (cache Redis/edge) → rewrite vào route group `app/[siteId]/[locale]/…`.
- Traefik route mọi domain về cùng container web; thêm site mới = thêm 1 row DB + 1 DNS record, **không cần deploy lại**.
- Mọi bảng nội dung đều có `site_id` (shared-schema multi-tenancy) + index `(site_id, …)`. Khi cần cô lập mạnh hơn mới cân nhắc RLS theo `site_id`.

### 5.2 i18n

- UI strings: `next-intl`, message files theo locale, đường dẫn `/{locale}/…` (vd `/vi/gioi-thieu`, `/en/about`).
- Nội dung động: pattern **bảng dịch** —

```sql
posts (id, site_id, status, author_id, published_at, …)
post_translations (
  post_id, locale,          -- PK (post_id, locale)
  title, slug, excerpt, body, seo_title, seo_description
)
-- unique (site_id qua join, locale, slug)
```

- API nhận `Accept-Language` hoặc `?locale=`, trả bản dịch + danh sách locale sẵn có để web render hreflang.

## 6. Admin & Page Builder (kéo thả)

### 6.1 Lựa chọn công cụ

| Phương án | Đánh giá |
|---|---|
| **Puck** (khuyến nghị) | MIT, React drag-and-drop page builder, self-host, data là JSON, tích hợp thẳng vào Next.js admin. Không vendor lock-in. |
| Craft.js | Framework để **tự build** editor — linh hoạt tối đa nhưng tốn công; chỉ chọn khi Puck không đáp ứng UX mong muốn. |
| GrapesJS | Kéo thả HTML/CSS tự do — **không khuyến nghị**: phá design system, khó kiểm soát SEO/performance, output khó render qua RSC. |
| Builder.io / Plasmic | SaaS, mạnh nhưng trả phí theo usage + lock-in — ngược mục tiêu tự chủ hạ tầng. |

### 6.2 Kiến trúc block-based

- Trang = **cây JSON các block** `{ type, props, children }`, lưu tại `page_translations.content (jsonb)` — mỗi locale một cây riêng, khớp pattern bảng dịch ở §5.
- **Component registry** đặt trong `packages/ui`: mỗi block (Hero, RichText, Gallery, FAQ, CTA, ProductGrid, Form…) = 1 React component + 1 zod schema cho props.
- **Cùng một registry, hai nơi dùng:** admin render editor kéo thả từ registry; web render trang công khai cũng từ đúng registry đó (server-side). Kết quả:
  - WYSIWYG thật — thấy gì trong editor, ra đúng vậy ngoài site;
  - **SEO không bị ảnh hưởng** — output vẫn là HTML SSR/ISR, block FAQ/Product tự sinh JSON-LD tương ứng (§9);
  - Flutter sau này có thể render cùng cây JSON bằng bộ widget tương ứng nếu cần.
- Mỗi block schema có `version` + hàm migrate — đổi schema không làm vỡ trang cũ.
- Theme tokens per site (từ `sites.settings`) để cùng một block tự đổi màu/font theo brand từng site.

### 6.3 Workflow biên tập

```
Soạn (draft) ──► Preview (Next.js Draft Mode, đúng renderer của site)
        │
        ▼
Publish ──► lưu page_revisions ──► revalidateTag() ──► live sau vài giây
                    │
                    └──► Rollback về revision bất kỳ = 1 click
```

- Media picker gắn thẳng R2/S3; ảnh chèn vào block tự đi qua `next/image`.
- Phân quyền theo RBAC §8: editor chỉ sửa site được gán; publish cần role phù hợp.
- **Giới hạn có chủ đích:** chỉ kéo thả block đã đăng ký, không cho tự do HTML/CSS — đây là cách giữ design system, Core Web Vitals và accessibility khi có nhiều người biên tập.

## 7. Chuẩn API

- **REST + OpenAPI 3.1**, prefix `/api/v1` (version qua URL). NestJS + `@nestjs/swagger` tự sinh spec → publish spec làm hợp đồng cho Flutter (sinh Dart client bằng openapi-generator) và web (sinh TS client).
- Response envelope thống nhất: `{ data, meta }`; lỗi theo **RFC 9457 Problem Details** (`application/problem+json`).
- **Cursor pagination** (`?cursor=&limit=`) thay offset — ổn định với dữ liệu lớn.
- **Idempotency-Key** header cho POST quan trọng (thanh toán, tạo đơn).
- Rate limiting per-IP + per-token (Redis sliding window), trả `429 + Retry-After`.
- Filtering/sorting quy ước: `?filter[status]=published&sort=-published_at`.
- **Webhooks** ký HMAC-SHA256 cho hệ thống ngoài; **ETag/If-None-Match** cho cache phía client.
- GraphQL: chỉ thêm khi có nhu cầu query phức tạp từ nhiều client — không làm ngay.

## 8. Auth & phân quyền

- **Web:** đăng nhập qua API → access token JWT **ngắn hạn (10–15 phút)** + refresh token **rotation** (phát hiện reuse → thu hồi cả chuỗi). Token lưu **httpOnly + Secure + SameSite cookie**, không đụng localStorage. CSRF token cho mutation.
- **Mobile (Flutter):** cùng flow OAuth2; access token trong memory, refresh token trong Keychain/Keystore (`flutter_secure_storage`).
- **Social login:** Google / Apple (bắt buộc nếu lên App Store) qua OIDC.
- **Mật khẩu:** Argon2id; **2FA:** TOTP (+ recovery codes).
- **RBAC:** `users → user_site_roles (user_id, site_id, role) → role_permissions` — quyền theo từng site. Guard NestJS kiểm tra permission ở route level.
- **Tùy chọn nâng cấp:** khi cần SSO doanh nghiệp/SAML thì đặt Keycloak hoặc Zitadel trước API — thiết kế trên tương thích OIDC nên chuyển được mà không đổi client.

## 9. SEO / AEO / GEO

| Kỹ thuật | Triển khai |
|---|---|
| Render | SSR/ISR mọi trang công khai; `generateMetadata()` per page per locale |
| Structured data | JSON-LD: `Organization`, `WebSite`, `Article`, `Product`, `BreadcrumbList`, `FAQPage` — sinh từ dữ liệu API |
| Sitemap | `sitemap.xml` động **per site, per locale** + index sitemap; ping khi publish |
| hreflang | `alternates.languages` từ danh sách bản dịch thật (không khai locale chưa có nội dung) |
| Canonical | Tuyệt đối theo domain của site |
| OG images | `next/og` sinh ảnh động per bài viết |
| Core Web Vitals | `next/image` + CDN, font subset (Vietnamese!), RSC giảm JS, `priority` cho LCP |
| **AEO** (answer engines) | Khối FAQ/HowTo có schema, đoạn trả lời trực tiếp 40–60 từ đầu bài, heading dạng câu hỏi |
| **GEO** (generative engines) | `llms.txt` + `llms-full.txt` per site, nội dung có trích dẫn/số liệu rõ nguồn, RSS feed |
| ISR revalidation | API publish nội dung → gọi `revalidateTag()` webhook → cache mới trong vài giây |

## 10. Bảo mật (ngoài Auth)

- Validation mọi input: `class-validator` (API) + `zod` (web); output escaping mặc định của React.
- Helmet headers, CSP, CORS whitelist theo danh sách domain trong bảng `sites`.
- Secrets: không commit; dùng GitHub Environments secrets + `.env` trên server (hoặc SOPS/Doppler khi team lớn).
- Quét lỗ hổng: Dependabot + `pnpm audit` + **Trivy** scan Docker image trong CI (fail nếu CRITICAL).
- Audit log bảng riêng: ai, làm gì, lúc nào (mutation quan trọng).
- Backup: `pgBackRest` hoặc managed PITR; test restore định kỳ. Upload media versioning trên R2/S3.
- HTTPS everywhere (Traefik + Let's Encrypt), HSTS.

## 11. CI/CD & hạ tầng

### 11.1 Môi trường

| Env | Trigger | Hạ tầng |
|---|---|---|
| Preview/dev | PR | docker compose local; (tùy chọn Vercel preview cho web) |
| Staging | merge vào `main` | VPS #1 — compose stack riêng, DB riêng |
| Production | tag `v*` (hoặc approve manual) | VPS #2 (hoặc cùng VPS lúc đầu) |

### 11.2 Pipeline (GitHub Actions)

```
PR:      lint → typecheck → unit test → build (turbo cache)
main:    … → docker build (multi-stage, per app) → push GHCR (tag sha + latest)
         → Trivy scan → SSH deploy staging:
              docker compose pull
              docker compose run --rm migrate   # prisma migrate deploy
              docker compose up -d --wait       # healthcheck-gated
tag v*:  cùng image đã test ở staging (promote, không rebuild) → deploy prod
```

- **Dockerfile multi-stage:** deps → build → runner (`node:22-alpine`, non-root user, `output: 'standalone'` cho Next.js). Image ~150MB.
- Healthcheck endpoint `/healthz` mỗi app; compose `depends_on: condition: service_healthy`.
- Rollback = deploy lại tag image trước đó (một lệnh).
- **Lộ trình scale:** VPS + Compose (0→~100k users) → tách DB ra managed Postgres → k3s/Kubernetes khi cần autoscale nhiều node. Không dùng K8s ngay từ đầu.

### 11.3 Observability

- **Sentry** (web + api + flutter) — error tracking, release health.
- Structured logs `pino` → Loki/Grafana hoặc Better Stack.
- Metrics: `/metrics` Prometheus + Grafana dashboard (p95 latency, error rate, queue depth).
- Uptime: Better Uptime / UptimeRobot ping `/healthz`.

## 12. Roadmap

| Phase | Thời gian | Nội dung | Kết quả |
|---|---|---|---|
| **0 — Nền móng** | Tuần 1 | Monorepo, Docker dev, CI lint/test, Traefik + compose skeleton | `pnpm dev` chạy full stack; PR có CI |
| **1 — Core API** | Tuần 2–4 | Prisma schema (sites, users, content + translations), Auth đầy đủ (JWT rotation, RBAC, social), Swagger, seed | API chạy staging, spec OpenAPI publish |
| **2 — Web + SEO** | Tuần 4–8 | Next.js multi-site middleware, next-intl, trang nội dung ISR, JSON-LD, sitemap/hreflang, llms.txt | Site đầu tiên live, Lighthouse SEO ≥ 95 |
| **3 — Multi-site + Admin** | Tuần 8–12 | Admin dashboard + **Page Builder kéo thả (Puck)** với component registry, quản lý sites/nội dung/dịch, revisions + rollback, on-demand revalidation, media R2, site thứ 2 | Editor tự dựng trang bằng kéo thả; thêm site mới không cần deploy |
| **4 — Mobile + Hardening** | Tuần 12+ | Dart client từ OpenAPI, app Flutter đầu tiên, 2FA, Trivy gate, observability đầy đủ, backup drill | App beta + hệ thống production-grade |

## 13. Rủi ro & đối sách

| Rủi ro | Đối sách |
|---|---|
| Phức tạp hóa sớm (K8s, microservices, GraphQL ngay từ đầu) | Modular monolith NestJS + Compose; tách service khi có số liệu chứng minh cần |
| Trộn logic site trong code | Mọi thứ khác biệt giữa site nằm trong DB config, không hardcode |
| Schema dịch thuật sai từ đầu | Chốt pattern bảng `*_translations` ngay Phase 1 — đổi sau rất đắt |
| Web gọi thẳng DB "cho nhanh" | Cấm bằng kiến trúc: web container không có DB credentials |
| Đổi schema block làm vỡ trang cũ | Mỗi block có `version` + hàm migrate; test render toàn bộ revisions trong CI |
| Page builder cho tự do HTML/CSS → vỡ design system, tụt Core Web Vitals | Chỉ cho kéo thả block đã đăng ký trong registry |
| Token lộ trên mobile | Refresh rotation + reuse detection; secure storage |
