# Phase 0 — Triển khai local chi tiết (kimmysystem)

> Mục tiêu: cuối tuần 1, chạy `pnpm dev` là có full stack trên máy local, với site đầu tiên
> **kimmyphungmakeup** truy cập tại `http://kimmyphungmakeup.localhost:3000` (đa ngôn ngữ vi/en),
> API + Swagger tại `http://localhost:4000/docs`, và mọi task đều đã được push lên GitHub theo đúng quy tắc.
>
> Tài liệu liên quan: [system-design.md](./system-design.md) · [rollout-plan.md](./rollout-plan.md)

## Quy ước tên

| Thứ | Tên | Dùng ở đâu |
|---|---|---|
| Hệ thống / repo | `kimmysystem` (repo: `kimmy-systems`) | package scope `@kimmy/*`, DB name, container prefix |
| Site đầu tiên | `kimmyphungmakeup` | row trong bảng `sites`; local domain `kimmyphungmakeup.localhost` |
| Site demo thứ hai | `demo` | `demo.localhost` — để chứng minh multi-site chạy thật |

> `*.localhost` tự trỏ về `127.0.0.1` trong Chrome/Edge/Firefox — **không cần sửa hosts file**.
> Nếu cần cho tool ngoài browser (curl…), thêm vào `C:\Windows\System32\drivers\etc\hosts`:
> `127.0.0.1 kimmyphungmakeup.localhost demo.localhost`

## Tổng quan 7 task — mỗi task 1 Issue, 1 nhánh, 1 PR, push trong ngày

| Task | Ngày | Nhánh | Kết quả |
|---|---|---|---|
| T0.1 Repo skeleton | 1 (sáng) | `chore/1-repo-skeleton` | Monorepo pnpm + turbo chạy `pnpm lint` |
| T0.2 Docker dev stack | 1 (chiều) | `chore/2-docker-dev` | Postgres/Redis/MinIO/Mailpit up |
| T0.3 API NestJS | 2 | `feat/3-api-skeleton` | `/healthz` + Swagger `/docs` |
| T0.4 Prisma schema + seed | 3 | `feat/4-db-schema-seed` | DB có 2 sites, 2 locales, trang mẫu |
| T0.5 Web Next.js + i18n | 4 | `feat/5-web-i18n` | `/vi`, `/en` render bằng next-intl |
| T0.6 Multi-site middleware | 5 (sáng) | `feat/6-multisite-middleware` | 2 domain local ra 2 site khác nhau |
| T0.7 CI + branch protection | 5 (chiều) | `chore/7-ci` | PR nào cũng chạy lint/test/build |

---

## T0.1 — Repo skeleton (ngày 1, sáng)

### 1. Kiểm tra công cụ

```powershell
node -v      # v22.x
corepack enable; corepack prepare pnpm@latest --activate
pnpm -v      # 9.x+
docker run hello-world
git config --global core.autocrlf input
```

### 2. Tạo cấu trúc

```
kimmy-systems/
├─ apps/            # (trống, tạo ở T0.3, T0.5)
├─ packages/
│  └─ config/       # tsconfig + eslint dùng chung
├─ infra/compose/
├─ docs/            # đã có
├─ package.json  pnpm-workspace.yaml  turbo.json
├─ .gitignore  .editorconfig  .nvmrc (22)
```

**pnpm-workspace.yaml**
```yaml
packages: ["apps/*", "packages/*"]
```

**package.json (root)**
```json
{
  "name": "kimmysystem",
  "private": true,
  "packageManager": "pnpm@9",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "db:migrate": "pnpm --filter @kimmy/api db:migrate",
    "db:seed": "pnpm --filter @kimmy/api db:seed"
  },
  "devDependencies": { "turbo": "^2" }
}
```

**turbo.json**
```json
{
  "tasks": {
    "dev":   { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "lint": {}, "typecheck": {}, "test": {}
  }
}
```

**.gitignore**: `node_modules/`, `.env`, `.env.*`, `!.env.example`, `.next/`, `dist/`, `.turbo/`, `*.tsbuildinfo`

**packages/config**: `tsconfig.base.json` (strict, ES2022, moduleResolution bundler) + eslint flat config chung.

### 3. Push

```powershell
git checkout -b chore/1-repo-skeleton
git add .; git commit -m "chore: monorepo skeleton (pnpm + turbo + shared config)"
git push -u origin chore/1-repo-skeleton   # → mở PR "Closes #1" → merge
```

**DoD:** `pnpm install` + `pnpm lint` chạy không lỗi từ root.

---

## T0.2 — Docker dev stack (ngày 1, chiều)

**infra/compose/docker-compose.dev.yml**
```yaml
name: kimmysystem-dev
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: kimmy
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: kimmysystem
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U kimmy"], interval: 5s, retries: 10 }
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment: { MINIO_ROOT_USER: kimmy, MINIO_ROOT_PASSWORD: devdevdev }
    volumes: [miniodata:/data]
  mailpit:
    image: axllent/mailpit
    ports: ["1025:1025", "8025:8025"]
volumes: { pgdata: {}, miniodata: {} }
```

```powershell
docker compose -f infra/compose/docker-compose.dev.yml up -d
docker compose -f infra/compose/docker-compose.dev.yml ps   # 4 services healthy/running
```

**DoD:** 4 service chạy; MinIO console mở được ở `localhost:9001`; Mailpit ở `localhost:8025`. Push PR như T0.1.

---

## T0.3 — API NestJS (ngày 2)

### 1. Scaffold

```powershell
pnpm dlx @nestjs/cli new apps/api --package-manager pnpm --strict
# đổi name trong apps/api/package.json → "@kimmy/api"
pnpm --filter @kimmy/api add @nestjs/swagger @nestjs/config zod
pnpm --filter @kimmy/api add -D prisma
pnpm --filter @kimmy/api add @prisma/client
```

### 2. Env có validate

**apps/api/.env.example** (commit) và **.env** (không commit):
```
PORT=4000
DATABASE_URL=postgresql://kimmy:dev@localhost:5432/kimmysystem
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_KEY=kimmy
S3_SECRET=devdevdev
SMTP_URL=smtp://localhost:1025
```

`src/config/env.ts`: zod schema parse `process.env` lúc boot — thiếu key là throw ngay, không chạy tiếp.

### 3. Endpoint tối thiểu + Swagger

- `GET /healthz` → `{ status: 'ok', uptime }` (dùng cho compose healthcheck + CI smoke sau này)
- `main.ts`: prefix `api/v1` (trừ healthz), SwaggerModule tại `/docs`, `app.enableCors()` tạm mở cho dev.

```powershell
pnpm --filter @kimmy/api dev
curl http://localhost:4000/healthz          # {"status":"ok"}
# mở http://localhost:4000/docs
```

**DoD:** healthz + Swagger sống. Push PR.

---

## T0.4 — Prisma schema v0 + seed 2 sites (ngày 3)

### 1. Schema khởi điểm — đúng pattern đã chốt trong system-design §5

**apps/api/prisma/schema.prisma** (rút gọn phần chính):
```prisma
model Site {
  id            String   @id @default(cuid())
  slug          String   @unique              // "kimmyphungmakeup", "demo"
  name          String
  domains       SiteDomain[]
  defaultLocale String                        // "vi"
  locales       String[]                      // ["vi","en"]
  settings      Json     @default("{}")      // theme tokens, contact, social…
  pages         Page[]
}

model SiteDomain {
  id      String @id @default(cuid())
  domain  String @unique   // "kimmyphungmakeup.localhost" | prod: "kimmyphungmakeup.com"
  siteId  String
  site    Site   @relation(fields: [siteId], references: [id])
  isPrimary Boolean @default(false)
}

model Page {
  id           String   @id @default(cuid())
  siteId       String
  site         Site     @relation(fields: [siteId], references: [id])
  status       PageStatus @default(DRAFT)    // DRAFT | PUBLISHED
  publishedAt  DateTime?
  translations PageTranslation[]
  @@index([siteId, status])
}

model PageTranslation {
  pageId         String
  locale         String
  title          String
  slug           String
  seoTitle       String?
  seoDescription String?
  content        Json    @default("[]")      // cây block cho page builder (Phase 3)
  page           Page    @relation(fields: [pageId], references: [id])
  @@id([pageId, locale])
  @@unique([locale, slug, pageId])
}

enum PageStatus { DRAFT PUBLISHED }
```

> Bảng domain tách riêng (`SiteDomain`) để một site có nhiều domain (www, alias, local vs prod) — middleware chỉ cần lookup 1 bảng.

### 2. Migrate + seed

```powershell
pnpm --filter @kimmy/api exec prisma migrate dev --name init
```

**apps/api/prisma/seed.ts** tạo:
- Site `kimmyphungmakeup` — name "Kimmy Phùng Makeup", locales `["vi","en"]`, default `vi`,
  domains: `kimmyphungmakeup.localhost` (primary). Trang: Home + About, bản dịch vi/en, status PUBLISHED.
- Site `demo` — domain `demo.localhost`, 1 trang Home vi — tồn tại chỉ để chứng minh multi-site.

Script trong apps/api/package.json: `"db:migrate": "prisma migrate dev"`, `"db:seed": "tsx prisma/seed.ts"`.

### 3. API đọc dữ liệu (2 endpoint đầu tiên)

```
GET /api/v1/sites/resolve?domain=kimmyphungmakeup.localhost
  → { id, slug, name, defaultLocale, locales, settings }
GET /api/v1/sites/:siteId/pages/:slug?locale=vi
  → { title, seoTitle, seoDescription, content, availableLocales: ["vi","en"] }
```

`availableLocales` trả về ngay từ giờ — web dùng để render hreflang về sau.

**DoD:** `pnpm db:seed` idempotent (chạy 2 lần không lỗi); 2 endpoint trả đúng qua Swagger. Push PR.

---

## T0.5 — Web Next.js + next-intl (ngày 4)

### 1. Scaffold

```powershell
pnpm create next-app apps/web --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*"
# đổi name → "@kimmy/web"; port dev: "dev": "next dev -p 3000"
pnpm --filter @kimmy/web add next-intl
```

**apps/web/.env.example**: `API_URL=http://localhost:4000/api/v1`

### 2. Cấu trúc route theo locale

```
app/
├─ [locale]/
│  ├─ layout.tsx        # NextIntlClientProvider + <html lang={locale}>
│  ├─ page.tsx          # Home — fetch page "home" từ API theo site + locale
│  └─ [slug]/page.tsx   # trang nội dung động
├─ i18n/ (messages/vi.json, en.json — UI strings)
```

- `generateMetadata()` đọc `seoTitle/seoDescription` từ API + `alternates.languages` từ `availableLocales`.
- Fetch từ server component: `fetch(\`${API_URL}/sites/${siteId}/pages/${slug}?locale=${locale}\`, { next: { revalidate: 60 } })` — bật ISR ngay từ đầu.

**DoD:** `http://localhost:3000/vi` và `/en` render nội dung seed (tạm hardcode site kimmyphungmakeup — T0.6 sẽ gỡ). Push PR.

---

## T0.6 — Multi-site middleware (ngày 5, sáng) — bước "ăn tiền" của Phase 0

**apps/web/middleware.ts** (logic chính):
```ts
export async function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0] ?? "";   // bỏ :3000
  const site = await resolveSite(host);   // gọi /sites/resolve?domain=… , cache trong memory/Redis TTL 60s
  if (!site) return NextResponse.rewrite(new URL("/site-not-found", req.url));

  const { pathname } = req.nextUrl;
  const locale = pickLocale(pathname, site);   // /vi/... | /en/... | thiếu → redirect sang defaultLocale
  const res = NextResponse.rewrite(
    new URL(`/${locale}${stripLocale(pathname)}`, req.url)
  );
  res.headers.set("x-site-id", site.id);        // layout/page đọc siteId từ header này
  return res;
}
```

- Layout/page đọc `x-site-id` (qua `headers()`) thay vì hardcode — gỡ hardcode của T0.5.
- Trang 404 riêng cho "domain chưa đăng ký".

### Kiểm tra multi-site thật

```
http://kimmyphungmakeup.localhost:3000   → redirect /vi → trang Kimmy Phùng Makeup
http://kimmyphungmakeup.localhost:3000/en → bản tiếng Anh
http://demo.localhost:3000               → trang site Demo (nội dung khác!)
http://khac.localhost:3000               → site-not-found
```

**DoD:** cả 4 URL trên đúng như mô tả. Push PR.

---

## T0.7 — CI + branch protection (ngày 5, chiều)

**.github/workflows/ci.yml**
```yaml
name: ci
on: pull_request
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint typecheck build
      # test: thêm khi có unit test đầu tiên (Phase 1)
```

Trên GitHub → Settings → Branches → rule cho `main`:
- Require a pull request before merging (solo: bỏ required reviewers)
- Require status checks: `verify` + require branch up-to-date
- Squash merge only; auto-delete head branches

**DoD:** mở 1 PR thử → thấy check `verify` chạy và bắt buộc. Push PR.

---

## Nghiệm thu Phase 0 (chạy lại từ máy sạch để chắc chắn)

```powershell
git clone git@github.com:<you>/kimmy-systems.git; cd kimmy-systems
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
docker compose -f infra/compose/docker-compose.dev.yml up -d
pnpm db:migrate; pnpm db:seed
pnpm dev
```

- [ ] `kimmyphungmakeup.localhost:3000/vi` + `/en` render từ DB, title/description đúng per locale
- [ ] `demo.localhost:3000` ra site khác — multi-site hoạt động
- [ ] `localhost:4000/docs` — Swagger đủ 3 endpoint (healthz, resolve, pages)
- [ ] `pnpm turbo lint typecheck build` xanh; CI bắt buộc trên PR
- [ ] 7 PR đã merge, `main` có 7 commit squash — đúng nhịp "xong task là push"

**Bước tiếp theo:** Phase 1 (Core API) — bảng users + auth JWT rotation, RBAC theo site ([system-design.md §8](./system-design.md)).
