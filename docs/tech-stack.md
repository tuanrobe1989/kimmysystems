# Kimmy Systems — Danh mục công nghệ chi tiết

> Mỗi công nghệ trong hệ thống được mô tả theo 4 câu hỏi:
> **Là gì** · **Giải quyết vấn đề gì** (và nếu không dùng thì đau ở đâu) · **Vì sao chọn nó** (thay vì phương án khác) · **Dùng ở đâu trong kimmysystem**.
> Trạng thái: ✅ đang dùng trong repo · 🔜 theo kế hoạch (ghi Phase).
> Tài liệu liên quan: [system-design.md](./system-design.md) · [rollout-plan.md](./rollout-plan.md) · [phase-0-local.md](./phase-0-local.md)

---

## 1. Ngôn ngữ & nền tảng chung

### TypeScript 5.9 — ✅

- **Là gì:** JavaScript có hệ thống kiểu tĩnh — compiler kiểm tra kiểu dữ liệu trước khi code chạy.
- **Giải quyết vấn đề gì:** Lỗi kinh điển của hệ web là **lệch dữ liệu ở ranh giới FE/BE**: API đổi tên field, web vẫn đọc tên cũ, và người dùng là người phát hiện. TypeScript biến loại lỗi đó thành lỗi biên dịch — phát hiện lúc gõ code, không phải lúc chạy production. Nó cũng làm refactor an toàn: đổi một type, compiler chỉ ra mọi chỗ phải sửa trong toàn monorepo.
- **Vì sao chọn:** Quyết định gốc của cả hệ thống là **một ngôn ngữ cho cả web + API** — một dev làm được hai đầu, share được types/validation, tuyển người dễ hơn. Nếu API viết Python thì mất toàn bộ lợi ích share code, phải duy trì 2 bộ tooling, 2 bộ convention.
- **Dùng ở đâu:** 100% code: `apps/web`, `apps/api`, `packages/*`, scripts, seed, test.

### Node.js 22 LTS — ✅

- **Là gì:** Runtime chạy JavaScript/TypeScript phía server.
- **Giải quyết vấn đề gì:** "Máy tôi chạy được, máy bạn lỗi" thường bắt nguồn từ lệch version runtime. Pin Node 22 trong `engines` (package.json) + `.nvmrc` khiến mọi máy dev, CI và Docker image dùng đúng một version — lệch là cảnh báo ngay lúc `pnpm install`.
- **Vì sao chọn:** Bản LTS mới nhất (hỗ trợ đến 2027), hiệu năng V8 tốt; Deno/Bun chưa đủ chín cho hệ sinh thái NestJS/Prisma.
- **Dùng ở đâu:** Runtime của cả `apps/api` lẫn `apps/web`, base image Docker (`node:22-alpine`).

### pnpm 9 — ✅

- **Là gì:** Trình quản lý package, thay thế npm/yarn.
- **Giải quyết vấn đề gì:** Hai vấn đề: (1) monorepo có nhiều app → npm nhân bản `node_modules` khổng lồ và cài chậm; pnpm lưu mỗi package đúng một lần trên đĩa (content-addressable store) rồi symlink. (2) **Phantom dependencies** — code import một package không khai báo trong package.json (chạy được do npm trải phẳng node_modules, rồi vỡ bất ngờ khi cây phụ thuộc đổi); cấu trúc nghiêm ngặt của pnpm chặn hẳn loại lỗi này.
- **Vì sao chọn:** Nhanh nhất và nghiêm ngặt nhất trong npm/yarn/pnpm; `workspace:*` protocol liên kết các package nội bộ; `--frozen-lockfile` bảo đảm CI cài đúng từng byte như lockfile.
- **Dùng ở đâu:** Toàn bộ cài đặt + scripts (`pnpm dev`, `pnpm db:migrate`…); workspace khai báo trong `pnpm-workspace.yaml`.

### Turborepo 2 — ✅

- **Là gì:** Bộ điều phối task cho monorepo — chạy build/lint/test của nhiều package theo đúng thứ tự phụ thuộc, có cache.
- **Giải quyết vấn đề gì:** Không có nó, mỗi lần CI chạy là build + test **tất cả** app dù bạn chỉ sửa 1 file README — 15 phút chờ cho thay đổi 1 dòng. Turbo hash nội dung từng package: cái gì không đổi thì lấy kết quả cache, chỉ chạy lại phần bị ảnh hưởng → CI còn 2–4 phút, và `pnpm dev` một lệnh chạy song song web + api.
- **Vì sao chọn:** Nhẹ và ít khái niệm hơn Nx (Nx mạnh hơn nhưng dư cho 2–3 app); Lerna đã lỗi thời.
- **Dùng ở đâu:** `turbo.json` định nghĩa pipeline `dev/build/lint/typecheck/test`; CI gọi `pnpm turbo lint typecheck build`.

### zod — ✅

- **Là gì:** Thư viện khai báo schema và validate dữ liệu **lúc runtime**, đồng thời suy ra type TypeScript từ chính schema đó.
- **Giải quyết vấn đề gì:** Type của TypeScript **biến mất khi chạy** — dữ liệu từ bên ngoài (HTTP body, env vars, form, file JSON) có thể sai kiểu mà compiler không thể biết. Thiếu validation runtime, một `.env` thiếu key làm app chạy nửa vời rồi lỗi khó hiểu ở chỗ khác; một request body sai kiểu đi thẳng vào DB. Với zod: khai báo schema một lần, được cả kiểm tra runtime lẫn type tĩnh — không viết hai lần, không lệch nhau.
- **Vì sao chọn:** Phổ biến nhất hệ TS, tích hợp tốt với cả NestJS lẫn React form; thay thế cặp class-validator/class-transformer nhiều boilerplate hơn.
- **Dùng ở đâu:** (1) `env.ts` của cả api lẫn web — thiếu/sai env là app **từ chối khởi động** với thông báo rõ ràng; (2) validate body/query ở API; (3) validate form ở web; (4) tương lai: schema props của từng block trong page builder.

---

## 2. Frontend web

### Next.js 15 (App Router) — ✅

- **Là gì:** Framework React chạy cả server lẫn client: render HTML trên server (SSR), build sẵn trang tĩnh có hạn dùng (ISR), routing theo file, middleware chạy trước mọi request.
- **Giải quyết vấn đề gì:** Ba vấn đề sống còn của dự án:
  1. **SEO** — React SPA thuần trả về `<div id="root"></div>` trống; crawler và AI engine thấy trang trắng. SSR/ISR trả HTML đầy đủ ngay từ byte đầu tiên.
  2. **Tốc độ + nội dung tươi** — ISR cho tốc độ trang tĩnh (serve từ cache) nhưng nội dung vẫn cập nhật: khi admin publish, API gọi `revalidateTag()` và trang mới xuất hiện sau vài giây, không cần rebuild toàn site.
  3. **Multi-site** — middleware đọc `Host` header trước mọi request, tra site config, rewrite vào đúng site + locale. Đây là xương sống của "một app phục vụ N domain".
  Ngoài ra React Server Components giảm lượng JS gửi xuống client (Core Web Vitals), và `generateMetadata()` sinh title/description/hreflang per trang per locale.
- **Vì sao chọn:** Là framework duy nhất gom đủ SSR + ISR + on-demand revalidation + middleware + RSC trong một hệ đã chín. Remix/SvelteKit thiếu ISR tương đương; Astro mạnh trang tĩnh nhưng yếu phần app động.
- **Dùng ở đâu:** Toàn bộ `apps/web`: `app/[locale]/…`, `middleware.ts` (multi-site), `generateMetadata`, ISR fetch `{ next: { revalidate } }`.

### React 19 — ✅

- **Là gì:** Thư viện UI theo component — giao diện là hàm của dữ liệu.
- **Giải quyết vấn đề gì:** UI phức tạp (đa ngôn ngữ, đa site, page builder) cần tách thành component tái sử dụng; React quản lý cập nhật DOM khi dữ liệu đổi thay vì thao tác DOM tay dễ lỗi. Server Components (v19) cho phép component chạy hẳn trên server — fetch dữ liệu trực tiếp, không gửi JS thừa xuống client.
- **Vì sao chọn:** Đi cùng Next.js; hệ sinh thái lớn nhất — và **Puck (page builder) là thư viện React**, chọn khác là mất nó.
- **Dùng ở đâu:** Mọi UI của web (và admin sau này); component registry cho page builder đặt tại `packages/ui` (Phase 3).

### next-intl 4 — ✅

- **Là gì:** Thư viện i18n chuyên cho Next.js App Router: routing theo locale, message dịch, format ngày/số/số nhiều theo từng ngôn ngữ.
- **Giải quyết vấn đề gì:** Tự làm i18n là tự viết: parse locale từ URL, redirect khi thiếu locale, load đúng file dịch, xử lý số nhiều ("1 sản phẩm" / "2 products"), format ngày kiểu VN vs US — mỗi thứ đều dễ sai và sai là hỏng SEO (duplicate content giữa các locale, thiếu hreflang). next-intl làm sẵn tất cả, đúng chuẩn App Router + Server Components.
- **Vì sao chọn:** Thư viện i18n sâu nhất cho App Router hiện nay; `next-i18next` thiết kế cho Pages Router cũ; react-intl thuần không lo phần routing.
- **Dùng ở đâu:** Routing `/vi/...`, `/en/...`; UI strings trong `apps/web/i18n/messages/{vi,en}.json`; `<html lang>` đúng từng locale. (Nội dung động thì dịch ở tầng DB — bảng `*_translations` — không qua next-intl.)

### Tailwind CSS 4 — ✅

- **Là gì:** Framework CSS utility-first — style bằng class có sẵn (`flex`, `px-4`, `text-lg`) ngay trong markup thay vì viết file CSS riêng.
- **Giải quyết vấn đề gì:** CSS truyền thống phình vô hạn: không ai dám xóa rule cũ vì không biết chỗ nào còn dùng, và đặt tên class là cuộc chiến bất tận. Tailwind loại bỏ cả hai — style nằm cạnh markup, xóa component là style chết đi theo, không cần đặt tên. Quan trọng cho dự án này: **v4 cấu hình bằng CSS variables**, khớp trực tiếp cơ chế theme-per-site — mỗi site một bộ token màu/font từ `sites.settings`, cùng component render ra brand khác nhau.
- **Vì sao chọn:** Tiêu chuẩn de-facto của hệ React; styled-components/emotion có chi phí runtime và không thân server components.
- **Dùng ở đâu:** Toàn bộ style của `apps/web` (và admin, page builder blocks sau này).

### Manrope qua @fontsource — ✅

- **Là gì:** Font chữ self-host, đóng gói thành npm package thay vì nhúng từ Google Fonts CDN.
- **Giải quyết vấn đề gì:** Font từ CDN bên thứ ba: (1) request đến Google lộ IP người dùng (vấn đề GDPR ở EU); (2) thêm một DNS/TLS handshake làm chậm LCP; (3) CDN sập/bị chặn là chữ hỏng. Self-host: font đi cùng app, được cache và tối ưu bởi chính Next.js.
- **Vì sao chọn:** @fontsource cho cài font như npm dependency — version pin được, build tự subset. **Bắt buộc dùng subset `vietnamese`** — thiếu là dấu tiếng Việt render bằng font fallback, chữ lệch nhau.
- **Dùng ở đâu:** `apps/web` — font mặc định của hệ thống; site có brand riêng sẽ khai báo font riêng qua theme tokens.

### eslint-plugin-jsx-a11y — ✅

- **Là gì:** Plugin ESLint bắt lỗi accessibility trong JSX (ảnh thiếu `alt`, button không có tên, tương tác không dùng được bàn phím…).
- **Giải quyết vấn đề gì:** Lỗi accessibility gần như không thể phát hiện bằng mắt dev, nhưng chặn hẳn một nhóm người dùng và bị Lighthouse trừ điểm. Bắt ở lúc lint là chi phí thấp nhất; sửa sau khi thành nợ là đắt nhất.
- **Dùng ở đâu:** ESLint config của `apps/web`.

---

## 3. Backend API

### NestJS 11 — ✅

- **Là gì:** Framework Node.js có kiến trúc: module, dependency injection (DI), guard (chặn request theo quyền), interceptor, pipe — tổ chức tương tự Angular/Spring.
- **Giải quyết vấn đề gì:** Express thuần không áp đặt cấu trúc — 6 tháng sau codebase là spaghetti mỗi người viết một kiểu, logic nghiệp vụ trộn lẫn routing. NestJS trả lời sẵn "file này để đâu, logic này thuộc tầng nào": module tách theo domain (sites, pages, auth…), DI khiến mọi service **mock được khi test**, guard là chỗ chuẩn để cắm RBAC (kiểm tra quyền theo site ở một nơi duy nhất thay vì rải if khắp nơi).
- **Vì sao chọn:** Cấu trúc + hệ sinh thái (Swagger, BullMQ, Passport tích hợp sẵn) mạnh nhất trong các framework Node. Loại: Express/Fastify thuần (tự chế mọi tầng), **FastAPI/Python** (phá nguyên tắc một ngôn ngữ khi chưa có nhu cầu AI/ML thực).
- **Dùng ở đâu:** Toàn bộ `apps/api`; sau này thêm module auth, RBAC guard, BullMQ processor đều theo khung này.

### @nestjs/swagger — ✅

- **Là gì:** Sinh tài liệu + spec OpenAPI 3.1 tự động từ decorator trong code NestJS; kèm UI thử API tại `/docs`.
- **Giải quyết vấn đề gì:** Spec viết tay **luôn luôn** lệch code theo thời gian — và spec lệch còn tệ hơn không có spec, vì client tin vào điều sai. Sinh từ code nghĩa là code đổi thì spec đổi theo, không thể lệch. Spec này là **hợp đồng trung tâm của kiến trúc API-first**: web, Flutter, và mọi app tương lai đều sinh client từ nó.
- **Dùng ở đâu:** `apps/api` — Swagger UI tại `/docs`; Phase 4 dùng spec này chạy openapi-generator sinh Dart client.

### Prisma 6 — ✅

- **Là gì:** ORM schema-first: mô tả DB trong file `schema.prisma`, Prisma sinh migration SQL + client TypeScript có type khớp DB 100%.
- **Giải quyết vấn đề gì:** Hai vấn đề: (1) **Query không type** — viết SQL string thuần thì đổi tên cột là lỗi runtime; Prisma client khiến `db.page.findMany({ where: { siteId } })` được compiler kiểm tra từng field. (2) **Trôi schema giữa các môi trường** — "DB staging khác DB local từ bao giờ?"; với migration file có version trong git, `migrate dev` ở local và `migrate deploy` trong pipeline bảo đảm mọi môi trường cùng một schema, có lịch sử.
- **Vì sao chọn:** Migration + typegen + tooling (Prisma Studio xem data) trưởng thành nhất. TypeORM: migration yếu, type lỏng. Drizzle: nhẹ và SQL-gần hơn nhưng hệ sinh thái non hơn cho tổ hợp NestJS này.
- **Dùng ở đâu:** `apps/api/prisma/schema.prisma` (Site, SiteDomain, Page, PageTranslation…), seed script, mọi truy cập DB của API. Web **không** dùng Prisma — web chỉ nói chuyện qua API (nguyên tắc API-first).

### tsx + SWC — ✅

- **Là gì:** `tsx` chạy file TypeScript trực tiếp không cần build trước; SWC là compiler Rust dịch TS nhanh gấp ~20 lần tsc.
- **Giải quyết vấn đề gì:** Script tiện ích (seed DB) mà phải build mới chạy được thì không ai muốn chạy; test suite compile chậm thì dev ngừng chạy test. Tốc độ ở đây là vấn đề **thói quen** — công cụ nhanh thì được dùng thường xuyên.
- **Dùng ở đâu:** `pnpm db:seed` (tsx); vitest compile qua SWC (`unplugin-swc`).

---

## 4. Dữ liệu & dịch vụ hạ tầng

### PostgreSQL 16 — ✅

- **Là gì:** Hệ quản trị cơ sở dữ liệu quan hệ mã nguồn mở, nguồn sự thật duy nhất của toàn hệ thống.
- **Giải quyết vấn đề gì:** Dự án này cần **đồng thời** hai loại dữ liệu trong một chỗ:
  1. *Quan hệ chặt* — users, roles theo site, quan hệ page↔translation: cần khóa ngoại, ràng buộc unique (`(locale, slug)`), transaction — những thứ bảo đảm dữ liệu không bao giờ ở trạng thái nửa vời.
  2. *Bán cấu trúc* — `sites.settings` (theme, contact… mỗi site một hình dạng), cây block của page builder: cần linh hoạt schema. **JSONB** cho đúng điều đó ngay trong Postgres — query được, index được, không cần DB thứ hai.
  Thêm nữa: full-text search có sẵn (đủ dùng trước khi cần Meilisearch), index composite `(site_id, …)` cho multi-tenant, Row-Level Security dự phòng khi cần cô lập site mạnh hơn.
- **Vì sao chọn:** MongoDB sai chỗ — dữ liệu này quan hệ điển hình, bỏ khóa ngoại là tự mời lỗi mồ côi bản dịch. MySQL: JSONB, RLS, FTS đều yếu hơn. Một DB duy nhất phục vụ web + mobile + admin đúng yêu cầu đề ra.
- **Dùng ở đâu:** Container `postgres:16-alpine` (dev), managed/VPS (prod); mọi bảng nghiệp vụ.

### Redis 7 — ✅

- **Là gì:** Kho key-value trong RAM — đọc/ghi micro-giây, có TTL, thao tác atomic.
- **Giải quyết vấn đề gì:** Ba vấn đề, một công cụ:
  1. **Cache resolve site** — middleware cần biết "domain này là site nào" ở **mọi request**; hỏi Postgres mỗi lần là cộng độ trễ vào toàn bộ website. Cache TTL 60s giảm còn ~1ms.
  2. **Rate-limit** — đếm request per-IP/per-token cần bộ đếm atomic tốc độ cao, đúng sở trường Redis.
  3. **Nền cho queue** — BullMQ chạy trên Redis, không cần thêm hệ message broker riêng.
- **Vì sao chọn:** Chuẩn ngành cho cả ba việc trên; Memcached chỉ làm được việc 1.
- **Dùng ở đâu:** Container `redis:7-alpine`; API dùng cho cache + rate-limit (Phase 1), BullMQ (Phase 1–2).

### BullMQ — 🔜 Phase 1–2

- **Là gì:** Hệ hàng đợi công việc (job queue) trên Redis: đẩy job vào queue, worker xử lý nền, tự retry khi lỗi.
- **Giải quyết vấn đề gì:** Việc chậm (gửi email, resize ảnh, gọi webhook revalidate) mà làm **trong** HTTP request thì người dùng chờ, request timeout, và lỗi giữa chừng là mất luôn. Đưa vào queue: response trả ngay, job chạy nền, lỗi thì retry với backoff, job hỏng vào dead-letter để soi.
- **Vì sao chọn:** Thư viện queue Node trưởng thành nhất, tích hợp NestJS chính thức. RabbitMQ/Kafka là cả một hệ phải vận hành riêng — quá nặng khi Redis đã có sẵn.
- **Dùng ở đâu (kế hoạch):** email transactional, on-demand revalidation sau publish, xử lý media.

### MinIO (dev) → Cloudflare R2 (prod) — ✅ dev / 🔜 prod

- **Là gì:** Kho lưu file (object storage) nói chuyện bằng S3 API — chuẩn giao tiếp lưu trữ file phổ biến nhất.
- **Giải quyết vấn đề gì:** Lưu file upload vào đĩa VPS là ngõ cụt: deploy lại container là mất, hai server không chia sẻ được, đĩa đầy là sập. Object storage tách file khỏi vòng đời server. Dev dùng MinIO (S3 self-host trong Docker, không cần mạng, không tốn tiền); prod dùng R2 — **cùng một S3 API nên code không đổi một dòng, chỉ đổi endpoint trong env**.
- **Vì sao chọn R2:** Không thu phí egress (băng thông tải ra) — với website nhiều ảnh được xem nhiều, đây là khoản chênh lớn nhất so với AWS S3.
- **Dùng ở đâu:** Container minio trong compose dev; Phase 3 media picker của admin upload vào đây.

### Mailpit — ✅ (chỉ dev)

- **Là gì:** SMTP server giả — nhận mọi email app gửi và hiển thị trong web UI thay vì gửi đi thật.
- **Giải quyết vấn đề gì:** Hai tai nạn: gửi nhầm email test đến người dùng thật, và không có cách nào xem email trông ra sao khi dev. Mailpit bắt tất cả tại `localhost:8025` — an toàn tuyệt đối, xem được cả HTML rendering.
- **Dùng ở đâu:** Compose dev; app trỏ `SMTP_URL=smtp://localhost:1025`.

### Meilisearch — 🔜 khi cần

- **Là gì:** Search engine chuyên full-text: chịu lỗi gõ (typo-tolerant), xếp hạng relevance, đa ngôn ngữ.
- **Giải quyết vấn đề gì:** Khi search trở thành tính năng chính (tìm sản phẩm/bài viết), Postgres full-text bắt đầu thiếu: không typo-tolerance, tiếng Việt không dấu khó xử lý, tuning relevance hạn chế.
- **Vì sao chọn (khi đến lúc):** Elasticsearch quá nặng vận hành cho quy mô này; Meilisearch một binary, cấu hình gần như không có. **Nguyên tắc: chưa thêm chừng nào Postgres còn đủ.**

---

## 5. Kiểm thử

### Vitest 3 — ✅

- **Là gì:** Test runner cho unit + integration test, cú pháp tương thích Jest, chạy trên Vite/SWC.
- **Giải quyết vấn đề gì:** Test là lưới an toàn cho quy tắc "xong task là push" — merge nhanh chỉ an toàn khi có test chặn hồi quy. Test runner chậm thì dev ngừng chạy test trước khi push; Vitest khởi động và chạy nhanh hơn Jest đáng kể, giữ thói quen sống.
- **Vì sao chọn:** Nhanh hơn Jest, cấu hình TS/ESM không đau, một công cụ cho cả web lẫn api.
- **Dùng ở đâu:** `vitest.config.ts` ở cả hai app; api có thêm `vitest.integration.config.ts` cho test chạm DB thật.

### Supertest — ✅

- **Là gì:** Thư viện gọi HTTP endpoint trực tiếp vào app NestJS trong test, không cần mở server thật.
- **Giải quyết vấn đề gì:** Unit test service không bắt được lỗi ở tầng HTTP: sai status code, guard chặn nhầm, serialize sai. Supertest test đúng những gì client thật sẽ nhận.
- **Dùng ở đâu:** Integration test của `apps/api` (vd: `GET /sites/resolve` trả đúng site theo domain).

### Playwright — ✅

- **Là gì:** Công cụ E2E test điều khiển browser thật (Chromium/Firefox/WebKit) làm đúng thao tác người dùng.
- **Giải quyết vấn đề gì:** Lỗi nguy hiểm nhất của hệ này nằm ở **chỗ ghép nối** mà unit test không thể thấy: middleware resolve sai site, redirect locale lặp vô hạn, hreflang trỏ nhầm. Chỉ browser thật đi qua `kimmyphungmakeup.localhost:3000` mới chứng minh được chuỗi middleware → API → render hoạt động đầu-cuối.
- **Vì sao chọn:** Xử lý multi-domain tốt (thiết yếu cho multi-site), nhanh và ổn định hơn Cypress, chạy tốt trong CI.
- **Dùng ở đâu:** Root `pnpm test:e2e`; kịch bản chính: mỗi domain ra đúng site, mỗi locale ra đúng nội dung + metadata.

---

## 6. Đóng gói & vận hành

### Docker + Docker Compose — ✅ dev / 🔜 staging-prod

- **Là gì:** Docker đóng ứng dụng + toàn bộ phụ thuộc vào image chạy y hệt nhau ở mọi nơi; Compose khai báo cả cụm service trong một file YAML.
- **Giải quyết vấn đề gì:** (1) **Trôi môi trường** — "local chạy, server lỗi" do lệch version Node/thư viện hệ thống; image là môi trường đóng băng, đã test ở staging thì prod chạy đúng image đó. (2) **Onboarding** — dev mới không cài tay Postgres/Redis/MinIO: `pnpm infra:up` là xong. (3) **Rollback** — image cũ còn trong registry, quay lại là một lệnh.
- **Chiến lược dev có chủ đích:** chỉ hạ tầng chạy container; web/api chạy `pnpm dev` ngoài để hot-reload tức thì. Prod thì tất cả vào container (multi-stage build, `node:22-alpine`, non-root, Next.js `output: standalone` → image ~150MB).
- **Dùng ở đâu:** `infra/compose/docker-compose.dev.yml` (4 services); Phase D thêm compose staging/prod.

### Traefik — 🔜 Phase D

- **Là gì:** Reverse proxy đứng trước mọi container: nhận request từ internet, route theo domain, tự quản lý SSL.
- **Giải quyết vấn đề gì:** Hệ multi-site nghĩa là **N domain trỏ về một server** — mỗi domain cần SSL và route đúng chỗ. Với Nginx: mỗi domain một file config + tự chạy certbot + reload. Traefik đọc label container và tự lấy chứng chỉ Let's Encrypt — **thêm site mới không sửa config proxy**, khớp mục tiêu "thêm site = thêm row DB".
- **Dùng ở đâu (kế hoạch):** Container đầu tiên trên VPS staging/prod, route mọi domain về web/api.

### GitHub Actions — ✅

- **Là gì:** Hệ CI/CD của GitHub — chạy workflow tự động khi có PR, push, tag.
- **Giải quyết vấn đề gì:** Quy tắc "xong task là push, merge nhanh" chỉ an toàn khi **máy chặn lỗi thay người**: mọi PR bị buộc qua lint + typecheck + test + build trước khi merge (branch protection). Nó cũng là cỗ máy deploy: merge main → tự build image → tự deploy staging; tag → deploy prod có bước Approve. Không có CI/CD tự động thì "deploy" là một người SSH chạy lệnh tay — chậm, phụ thuộc trí nhớ, không audit được.
- **Vì sao chọn:** Nằm ngay cạnh code, không thêm dịch vụ; Environments cho secrets riêng từng môi trường + required reviewers cho prod.
- **Dùng ở đâu:** `.github/workflows/ci.yml` (đang có); Phase D thêm `deploy-staging.yml`, `deploy-prod.yml`.

### GHCR (GitHub Container Registry) — 🔜 Phase D

- **Là gì:** Kho chứa Docker image của GitHub.
- **Giải quyết vấn đề gì:** Image build ở CI cần một chỗ lưu có version để server kéo về và để rollback về bản cũ. GHCR cùng hệ GitHub: cùng token, cùng phân quyền repo, private miễn phí — ít nhất một credential phải quản lý so với Docker Hub.
- **Dùng ở đâu (kế hoạch):** CI push `ghcr.io/<owner>/kimmy-{web,api}:<sha>`; server pull khi deploy.

### Trivy — 🔜 Phase D

- **Là gì:** Scanner quét lỗ hổng bảo mật (CVE) trong Docker image và dependencies.
- **Giải quyết vấn đề gì:** Image chứa hàng trăm package hệ điều hành + npm — lỗ hổng nghiêm trọng có thể nằm trong base image mà không ai biết. Trivy chạy trong CI và **fail pipeline nếu có CVE mức CRITICAL** — lỗ hổng bị chặn trước khi lên server, thay vì phát hiện sau khi bị khai thác.
- **Dùng ở đâu (kế hoạch):** Bước `scan` giữa build và deploy trong workflow staging/prod.

### Cloudflare — 🔜 Phase D–E

- **Là gì:** Lớp đứng giữa người dùng và VPS: DNS, CDN (cache nội dung gần người dùng), WAF (chặn request độc hại), chống DDoS.
- **Giải quyết vấn đề gì:** VPS trần chịu mọi thứ một mình: bot, DDoS, traffic spike. Cloudflare hấp thụ phần đó ở biên: nội dung tĩnh serve từ edge (nhanh hơn cho người dùng xa server), tấn công bị lọc trước khi chạm VPS, và DNS quản lý tập trung cho N domain của multi-site. Free tier đủ cho giai đoạn đầu.
- **Dùng ở đâu (kế hoạch):** DNS mọi domain; proxy trước staging + prod; R2 cùng tài khoản.

### VPS (Hetzner/DigitalOcean/Vultr) — 🔜 Phase D

- **Là gì:** Máy chủ ảo thuê theo tháng, toàn quyền cài đặt.
- **Giải quyết vấn đề gì:** Cần chỗ chạy Docker với **chi phí cố định đoán trước được**: staging ~$6–12/tháng, prod ~$20–40. Serverless/Vercel cho toàn hệ thì chi phí tăng theo traffic (đột biến là hóa đơn đột biến), multi-domain không giới hạn phức tạp hơn, và lock-in. **K8s cố tình chưa dùng** — độ phức tạp vận hành của nó chỉ đáng khi cần autoscale nhiều node, mà số liệu chưa đòi hỏi.
- **Dùng ở đâu (kế hoạch):** VPS #1 staging (Phase D), VPS #2 prod (Phase E), làm cứng theo checklist rollout-plan §D.1.

---

## 7. Bảo mật & Auth (Phase 1 trở đi)

### JWT access ngắn + refresh token rotation — 🔜 Phase 1

- **Là gì:** Access token (JWT) sống 10–15 phút chứng minh danh tính mỗi request; refresh token sống dài để lấy access mới, và **mỗi lần dùng là bị thay** (rotation).
- **Giải quyết vấn đề gì:** Bài toán: xác thực cho **cả web lẫn mobile** trên API stateless, và giới hạn thiệt hại khi token bị đánh cắp. Access ngắn hạn → token lộ chỉ dùng được vài phút. Rotation → refresh token cũ bị dùng lại (dấu hiệu bị đánh cắp) là hệ thống phát hiện và **thu hồi cả chuỗi phiên**. Web giữ token trong cookie httpOnly (JS không đọc được → chặn XSS ăn cắp token); Flutter giữ trong Keychain/Keystore.
- **Vì sao chọn:** Session cookie thuần không phục vụ tốt mobile; JWT thuần không thu hồi được — tổ hợp này lấy ưu của cả hai. Tương thích OIDC nên sau này cắm Keycloak/Zitadel (SSO doanh nghiệp) không đổi client.

### Argon2id — 🔜 Phase 1

- **Là gì:** Thuật toán băm mật khẩu, thắng cuộc thi Password Hashing Competition.
- **Giải quyết vấn đề gì:** Khi DB bị lộ (giả định phải tính đến), thứ bảo vệ mật khẩu người dùng là chi phí crack. Argon2id cố tình ngốn cả RAM lẫn CPU — vô hiệu hóa crack hàng loạt bằng GPU, thứ mà bcrypt (chỉ ngốn CPU) chống yếu hơn.

### OIDC social login (Google/Apple) — 🔜 Phase 1

- **Là gì:** Đăng nhập bằng tài khoản Google/Apple qua chuẩn mở OpenID Connect.
- **Giải quyết vấn đề gì:** Giảm ma sát đăng ký (không thêm một mật khẩu phải nhớ) và giảm gánh bảo mật (bớt mật khẩu để lộ). **Apple bắt buộc** theo chính sách App Store nếu app có social login khác — làm trước khỏi bị chặn duyệt app ở Phase 4.

### TOTP 2FA — 🔜 Phase 4

- **Là gì:** Mã 6 số sinh mỗi 30 giây từ app authenticator.
- **Giải quyết vấn đề gì:** Mật khẩu admin bị lộ (phishing, reuse) không còn đủ để chiếm tài khoản — đặc biệt quan trọng cho tài khoản quản trị nhiều site. Chọn TOTP thay SMS vì SMS dính rủi ro SIM-swap; kèm recovery codes khi mất máy.

### Helmet + CSP, CORS per-site — 🔜 Phase 1

- **Là gì:** Helmet đặt các HTTP security header chuẩn; CSP giới hạn nguồn script được chạy; CORS quy định origin nào được gọi API.
- **Giải quyết vấn đề gì:** Chặn nhóm tấn công trình duyệt (XSS, clickjacking) bằng cấu hình một lần. Điểm riêng của hệ multi-site: **CORS whitelist đọc từ bảng `sites`** — thêm site mới là origin của nó tự được phép, không sửa code, không mở toang `*`.

---

## 8. Nội dung & Mobile

### Puck — 🔜 Phase 3

- **Là gì:** Page builder kéo thả mã nguồn mở (MIT) cho React: admin kéo block, output là **cây JSON**, không phải HTML.
- **Giải quyết vấn đề gì:** Yêu cầu "editor tự dựng trang không cần dev" thường phải trả giá bằng SEO hoặc design system. Kiến trúc JSON + component registry né cả hai: cây JSON được render **server-side bằng đúng component React của web** → trang vẫn là HTML SSR chuẩn SEO, block FAQ/Product tự sinh JSON-LD; editor chỉ lắp được block đã đăng ký → không thể phá design system hay Core Web Vitals. Mỗi block schema có version + hàm migrate → đổi block không vỡ trang cũ.
- **Vì sao chọn:** GrapesJS output HTML tự do (phá cả hai điều trên); Builder.io/Plasmic là SaaS trả phí + lock-in. Puck self-host, MIT, data nằm trong Postgres của mình.
- **Dùng ở đâu (kế hoạch):** `apps/admin`; block registry tại `packages/ui`; cây JSON lưu `page_translations.content (jsonb)`.

### openapi-generator (Dart) — 🔜 Phase 4

- **Là gì:** Công cụ sinh code client từ OpenAPI spec — ở đây là Dart client cho Flutter.
- **Giải quyết vấn đề gì:** Viết tay lớp gọi API cho mobile là chép lại bằng tay những gì API đã khai báo — và mỗi lần API đổi là quên cập nhật. Sinh tự động: spec đổi → chạy lại generator → client Dart có model + method mới, sai lệch là lỗi compile Dart chứ không phải bug runtime trên máy người dùng.
- **Dùng ở đâu (kế hoạch):** Pipeline sinh package Dart từ spec của `apps/api`, app Flutter import.

---

## 9. Quan sát hệ thống (Phase D–E)

### Sentry — 🔜

- **Là gì:** Dịch vụ error tracking: mọi exception ở web, api, Flutter được gom về một chỗ kèm stack trace, browser/OS, release version.
- **Giải quyết vấn đề gì:** Không có nó, cách bạn biết production lỗi là **người dùng phàn nàn** — chậm và mù (không stack trace, không tái hiện được). Sentry báo lỗi ngay khi xảy ra kèm ngữ cảnh, và release health chỉ ra bản deploy nào sinh lỗi mới → biết ngay cần rollback bản nào.

### pino — 🔜

- **Là gì:** Logger JSON có cấu trúc cho Node — mỗi dòng log là object có field, không phải chuỗi tự do.
- **Giải quyết vấn đề gì:** `console.log` chuỗi tự do thì không filter được "mọi request lỗi của site X trong 1 giờ qua". Log có field (`siteId`, `userId`, `path`, `duration`) query được như dữ liệu — và là định dạng Loki/Grafana ăn được sau này. pino cũng nhanh nhất hệ Node (logging không thành nút thắt hiệu năng).

### Uptime monitor (UptimeRobot / Better Uptime) — 🔜

- **Là gì:** Dịch vụ ngoài ping `/healthz` mỗi phút, báo qua email/telegram khi không phản hồi.
- **Giải quyết vấn đề gì:** Sập lúc 3 giờ sáng thì Sentry im lặng (không có lỗi vì không có request nào chạy được) — cần một con mắt **từ bên ngoài**. Đây là món rẻ nhất trong toàn bộ hệ giám sát và là món phát hiện sự cố nghiêm trọng nhất.

### pg_dump → R2, sau nâng pgBackRest — 🔜 Phase E

- **Là gì:** Backup DB hàng đêm đẩy lên object storage; pgBackRest thêm point-in-time recovery (khôi phục về đúng một thời điểm).
- **Giải quyết vấn đề gì:** Mọi rủi ro khác đều khắc phục được trừ **mất dữ liệu**. Nguyên tắc: backup phải nằm ngoài server (server chết không kéo theo backup), và **backup chưa test restore thì coi như chưa có backup** — lịch restore drill nằm trong rollout-plan Phase E.

---

## Năm nguyên tắc chi phối mọi lựa chọn

1. **Một ngôn ngữ (TypeScript)** đến khi có lý do thật sự để thêm ngôn ngữ thứ hai.
2. **API-first:** OpenAPI spec là hợp đồng; web chỉ là một client như Flutter.
3. **Chuẩn mở, không lock-in:** S3 API, OIDC, OpenAPI, Docker — đổi nhà cung cấp là đổi endpoint, không đổi kiến trúc.
4. **Đơn giản trước, scale khi có số liệu:** Compose trước K8s, Postgres full-text trước Meilisearch, monolith trước microservices.
5. **Cấu hình nằm trong DB, không nằm trong code:** thêm site/domain/locale là thêm row, không deploy lại.
