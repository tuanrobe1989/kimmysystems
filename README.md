# Kimmy Systems

Nền móng Phase 0: pnpm + Turborepo, NestJS, PostgreSQL/Prisma, Next.js 15 và next-intl. Web chỉ đọc nội dung qua API.

## Chạy từ checkout mới

Yêu cầu: Node.js 22, pnpm **9.15.9**, Docker Desktop với Linux engine đang chạy. Trên Windows cần bật ảo hóa và WSL2.

```powershell
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm setup:env
pnpm infra:up
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Nếu shell đang ưu tiên một bản pnpm khác, thay `pnpm` bằng `npx --yes pnpm@9.15.9`; không cần thay cấu hình toàn hệ thống. `setup:env` giữ nguyên `.env` đã tồn tại. `db:deploy` áp dụng migration đã commit; dùng `pnpm db:migrate -- --name ...` khi phát triển schema (hoặc `pnpm --filter @kimmy/api exec prisma migrate dev --name ...`).

| Địa chỉ mặc định | Nội dung |
| --- | --- |
| http://kimmyphungmakeup.localhost:3000 | Redirect `/vi`, Home và Giới thiệu vi/en |
| http://demo.localhost:3000 | Site Demo, Home vi riêng |
| http://localhost:3000 | Alias local của Kimmy |
| http://khac.localhost:3000 | Website chưa đăng ký, HTTP 404 |
| http://localhost:4000/docs | Swagger |
| http://localhost:4000/healthz | API liveness |
| http://localhost:9001 | MinIO console; local login `kimmy` / `devdevdev` |
| http://localhost:8025 | Mailpit |

Chrome/Edge tự resolve `*.localhost`. Với công cụ không hỗ trợ, gửi HTTP request tới `127.0.0.1:3000` cùng header `Host: demo.localhost:3000`. Không cần sửa hosts của Windows.

## Cấu hình trên máy triển khai ban đầu

Ngày 2026-09-11: Docker engine chưa chạy vì Windows báo ảo hóa không khả dụng. PostgreSQL **16.15** bản portable chính thức từ EDB đã được chuẩn bị tại `.local/postgres/pgsql`; database nằm trong `.local/pgdata`. Đây là phương án chạy API/web local, không thay thế kiểm chứng Redis/MinIO/Mailpit trong Docker.

Cổng 4000 thuộc LocalWP nên `.env` trên máy này dùng **4001** cho API và `API_URL=http://localhost:4001/api/v1` cho web. Swagger local: http://localhost:4001/docs. Các `.env.example` và CI vẫn dùng 4000. Không commit `.env` hoặc dữ liệu `.local`.

Khởi động lại PostgreSQL portable đã được chuẩn bị trên máy này:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local-postgres.ps1
npx --yes pnpm@9.15.9 dev
```

Nếu chuyển sang Docker, dừng PostgreSQL portable trước để nhường cổng 5432:

```powershell
& .local/postgres/pgsql/bin/pg_ctl.exe -D .local/pgdata stop -m fast
pnpm infra:up
pnpm db:deploy
pnpm db:seed
```

Không xóa volume hoặc `.local/pgdata` khi chuyển môi trường. Không có bước restart Windows tự động.

## Kiểm thử

```powershell
pnpm turbo lint typecheck test build
pnpm exec tsc --noEmit -p tsconfig.e2e.json
```

Integration test dùng database **riêng** có tên kết thúc `_test`, không xóa database phát triển. Tạo và migrate trước lần chạy đầu:

```powershell
docker compose -f infra/compose/docker-compose.dev.yml exec -T postgres createdb -U kimmy kimmysystem_test
$env:DATABASE_URL='postgresql://kimmy:dev@localhost:5432/kimmysystem_test'
pnpm db:deploy
Remove-Item Env:DATABASE_URL
pnpm test:integration
```

Với portable PostgreSQL, thay dòng `createdb` bằng `& .local/postgres/pgsql/bin/createdb.exe -h 127.0.0.1 -U kimmy -W kimmysystem_test`. Database này đã được tạo trên máy triển khai ban đầu. Có thể cấu hình `TEST_DATABASE_URL` cho CI/máy khác.

```powershell
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
```

Trên máy đang dùng API 4001: đặt `$env:E2E_API_PORT='4001'` trước `test:e2e`. Playwright tự chạy các production server cần thiết và dừng server do nó tạo; có thể dùng lại server local đang chạy. CI luôn chạy server mới. Kết quả HTML, screenshot và trace lỗi lưu ở `playwright-report/` và `test-results/`.

CI job `verify` kiểm tra cả 4 Docker service, migration, seed lặp, lint/typecheck/unit/build, integration PostgreSQL và Chromium desktop/mobile. Bật required check `verify`, require branch up-to-date, PR bắt buộc, squash merge và tự xóa nhánh.

## Quyết định triển khai

- `PageTranslation` unique theo `(siteId, locale, slug)`; composite foreign key `(pageId, siteId)` ngăn gắn bản dịch vào page thuộc site khác. `Page.key` giúp seed idempotent ngay cả khi slug dịch khác nhau.
- Chỉ trả page `PUBLISHED` có `publishedAt <= now`. Thiếu trang/bản dịch trả 404, input sai trả 400. API Phase 0 giữ response trực tiếp theo tài liệu; auth và chuẩn hóa Problem Details thuộc phase sau.
- `translations: [{ locale, slug }]` bổ sung cho `availableLocales` để `/vi/gioi-thieu` và `/en/about` liên kết đúng. Demo bật vi/en ở site nhưng chỉ có Home vi; `/en` trả 404 và không có hreflang en giả.
- Middleware ghi tenant context vào **request headers**, ghi đè header client, chỉ dùng `Host` đã validate. Server Component resolve lại hostname; không tin riêng `x-site-id`.
- Cache resolve trong memory giới hạn 256 host, TTL 60 giây; lỗi upstream trả 503/no-store. Cache API của web tách theo site ID/slug/locale, revalidate sau 60 giây. Vì đọc `headers()`, HTML là SSR theo request; đây là **cache dữ liệu**, không phải full-page ISR. Full-page ISR cần route nội bộ theo site ở phase tối ưu sau.
- Metadata được hoàn thành trước streaming để giữ HTTP 404 thật. `DocumentLocale` cập nhật `html lang` khi đổi ngôn ngữ bằng client navigation.
- Seed là nội dung mẫu, sẽ cập nhật lại các bản ghi mẫu mỗi lần chạy. Không dùng seed này để quản lý nội dung production.
- Chưa triển khai auth, admin, page builder, staging hoặc production deployment.

Chi tiết phạm vi gốc: [Phase 0](docs/phase-0-local.md), [System design](docs/system-design.md), [Rollout](docs/rollout-plan.md).
