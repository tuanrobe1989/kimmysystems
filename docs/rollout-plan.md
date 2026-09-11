# Kimmy Systems — Kế hoạch triển khai (Local → Git/Test → Go-live)

> Playbook thực thi từng bước, bổ sung cho [system-design.md](./system-design.md).
> Quy tắc xuyên suốt: **xong một task = push lên Git trong ngày, không có ngoại lệ.**
> Ngày lập: 2026-09-11

---

## Giai đoạn A — Chuẩn bị (Ngày 0, ~nửa ngày)

### A.1 Công cụ trên máy local (Windows)

- [ ] **WSL2 + Docker Desktop** (bật WSL2 backend) — chạy Postgres/Redis local
- [ ] **Node 22 LTS** + bật pnpm qua corepack:
  ```
  corepack enable && corepack prepare pnpm@latest --activate
  ```
- [ ] **Git** cấu hình: `git config --global user.name/user.email`, `core.autocrlf=input`
- [ ] VS Code + extensions: ESLint, Prettier, Prisma, Docker

### A.2 Tài khoản dịch vụ

- [ ] **GitHub**: tạo repo private `kimmy-systems` (org nếu có team)
- [ ] **Cloudflare**: account (DNS + CDN + R2) — chưa cần domain ngay
- [ ] **VPS provider** (Hetzner / DigitalOcean / Vultr): chưa mua vội — cần từ Giai đoạn D
- [ ] **Sentry**: project cho web + api (free tier đủ dùng)

### A.3 Khởi tạo repo

```
cd D:\Projects\kimmy-systems
git init -b main
# .gitignore: node_modules, .env*, .next, dist, .turbo
git add . && git commit -m "chore: init repo with system design docs"
git remote add origin git@github.com:<you>/kimmy-systems.git
git push -u origin main
```

**Xong Giai đoạn A khi:** repo trên GitHub có docs/, máy local chạy được `docker run hello-world` và `pnpm -v`.

---

## Giai đoạn B — Local development (Tuần 1 = Phase 0 của system design)

### B.1 Scaffold monorepo

```
pnpm dlx create-turbo@latest .        # hoặc dựng tay pnpm-workspace.yaml
pnpm create next-app apps/web         # TypeScript, App Router, Tailwind
pnpm dlx @nestjs/cli new apps/api     # strict mode
# packages/: types, ui, config (eslint + tsconfig dùng chung)
```

### B.2 Hạ tầng local: chỉ services chạy Docker, app chạy ngoài

App (`web`, `api`) chạy bằng `pnpm dev` để hot-reload nhanh; chỉ hạ tầng chạy container:

```yaml
# infra/compose/docker-compose.dev.yml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment: { POSTGRES_PASSWORD: dev, POSTGRES_DB: kimmy }
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  minio:            # giả lập R2/S3 local
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
  mailpit:          # bắt email dev, xem tại localhost:8025
    image: axllent/mailpit
    ports: ["1025:1025", "8025:8025"]
volumes: { pgdata: }
```

### B.3 Quy ước env

- `.env.example` commit vào repo (đầy đủ key, giá trị giả) — `.env` thật **không bao giờ** commit.
- Mỗi app một `.env`; validate env lúc boot bằng zod (`packages/config/env.ts`) — thiếu key là app từ chối chạy, không lỗi ngầm.

### B.4 Vòng lặp hằng ngày của dev

```
docker compose -f infra/compose/docker-compose.dev.yml up -d
pnpm dev                # turbo chạy web:3000 + api:4000
pnpm db:migrate         # prisma migrate dev (khi đổi schema)
pnpm db:seed            # dữ liệu mẫu: 2 sites, 2 locales, vài trang
```

**Xong Giai đoạn B khi (Definition of Done — Phase 0):**
- [ ] `pnpm dev` chạy full stack một lệnh; `pnpm lint / typecheck / test / build` đều pass
- [ ] Swagger sống tại `api:4000/docs`; web đọc được 1 endpoint mẫu từ api
- [ ] Seed tạo 2 site + 2 locale để test multi-site ngay từ đầu

---

## Giai đoạn C — Git workflow: xong task là push (áp dụng từ Tuần 1, mãi mãi)

### C.1 Mô hình nhánh

```
main ────────●────────●────────●──── (protected, luôn deploy được)
              \feat/12-auth-jwt      ← 1 task = 1 nhánh = 1 PR
               \fix/31-hreflang-vi
```

- **`main` được bảo vệ:** không push thẳng; PR bắt buộc; CI xanh mới được merge; **squash merge** (lịch sử 1 task = 1 commit).
- Tên nhánh: `feat/<issue>-<slug>`, `fix/…`, `chore/…`. Task nào cũng có GitHub Issue trước khi code.

### C.2 Nhịp làm việc bắt buộc theo task

```
1. Nhận task  → tạo Issue (nếu chưa có) → tạo nhánh từ main mới nhất
2. Code       → commit nhỏ, theo Conventional Commits (feat:, fix:, chore:)
3. XONG TASK  → push + mở PR ngay trong ngày, mô tả link "Closes #12"
4. CI chạy    → lint, typecheck, test, build (turbo cache, ~2-4 phút)
5. Merge      → squash vào main → nhánh tự xóa → main tự deploy STAGING
6. Task chưa xong cuối ngày? → vẫn push nhánh + mở Draft PR
```

> Quy tắc số 1: **code chỉ tồn tại trên máy local tối đa 1 ngày.** Push cuối ngày kể cả dở dang (Draft PR) — chống mất máy/mất code, và ai cũng thấy tiến độ.

### C.3 CI trên PR (`.github/workflows/ci.yml`)

```yaml
on: pull_request
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - checkout → setup pnpm + node 22 (cache)
      - pnpm install --frozen-lockfile
      - pnpm turbo lint typecheck test build   # turbo chỉ chạy phần bị ảnh hưởng
```

Branch protection trên `main`: require status check `verify` + require branch up-to-date. Solo dev thì bỏ require review, vẫn giữ require CI.

---

## Giai đoạn D — Môi trường TEST/STAGING trên VPS (Tuần 2–3, song song Phase 1)

Dựng staging **sớm** (ngay khi API có endpoint đầu tiên) — đừng đợi xong mới deploy lần đầu.

### D.1 Mua & làm cứng VPS (1 buổi)

Ubuntu 24.04, 4GB RAM là đủ cho staging (~$6–12/tháng):

```bash
# Với user root lần đầu:
adduser deploy && usermod -aG sudo deploy
# copy SSH key sang deploy; sau đó:
#   PasswordAuthentication no, PermitRootLogin no  (trong sshd_config)
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable
apt install fail2ban -y
# Cài Docker Engine + compose plugin (script chính thức get.docker.com)
usermod -aG docker deploy
```

### D.2 Stack staging trên VPS

```
/srv/kimmy-staging/
├─ docker-compose.yml     # traefik + web + api + postgres + redis + migrate
├─ .env                   # secrets staging (chỉ nằm trên server)
└─ traefik/               # cấu hình Let's Encrypt
```

- DNS: `staging.<domain>.com` và `api-staging.<domain>.com` → IP VPS (Cloudflare, proxy bật).
- Traefik tự lấy SSL. **Web staging bắt buộc gắn header `X-Robots-Tag: noindex`** — không để Google index bản test.

### D.3 Deploy tự động khi merge vào main

`.github/workflows/deploy-staging.yml`:

```yaml
on: { push: { branches: [main] } }
jobs:
  build:   # matrix web/api → docker build multi-stage → push ghcr.io (tag = sha)
  scan:    # trivy image --severity CRITICAL --exit-code 1
  deploy:
    environment: staging          # secrets: SSH_HOST, SSH_KEY, GHCR_TOKEN
    steps:
      - ssh deploy@staging:
          docker compose pull
          docker compose run --rm migrate     # prisma migrate deploy
          docker compose up -d --wait          # chặn theo healthcheck
      - curl -f https://staging.<domain>/healthz   # smoke test, fail = đỏ workflow
```

**Nhịp sau khi có staging:** merge PR → 5–7 phút sau thấy trên staging → tester/khách xem bằng link staging. Đây chính là "đẩy lên git để test" của bạn — tự động 100%.

**Xong Giai đoạn D khi:**
- [ ] Merge một PR bất kỳ → staging tự cập nhật, không SSH tay
- [ ] `https://staging.<domain>/healthz` xanh; Swagger staging truy cập được
- [ ] Staging có `noindex`; secrets chỉ nằm trong GitHub Environments + `.env` trên VPS

---

## Giai đoạn E — GO-LIVE Production (cuối Phase 2, ~tuần 8)

### E.1 Hạ tầng prod (1–2 ngày, làm trước launch ≥1 tuần)

- VPS riêng cho prod (hoặc VPS to hơn: 8GB) — làm cứng y hệt D.1; stack tại `/srv/kimmy-prod/`.
- **Backup trước tiên, không phải sau cùng:** cron `pg_dump` mỗi đêm → đẩy lên R2 (hoặc pgBackRest PITR); **test restore một lần** trước launch.
- Sentry DSN prod, UptimeRobot/Better Uptime ping `/healthz` mỗi phút.

### E.2 Pre-launch checklist (T-3 ngày)

**Hạ tầng**
- [ ] DNS domain thật về Cloudflare, proxy bật, SSL Full (strict)
- [ ] `.env` prod đầy đủ (secrets mới, KHÔNG copy từ staging), JWT keys mới
- [ ] Backup chạy được + đã test restore; rate-limit bật; CORS đúng domain thật

**SEO — trước khi mở cửa**
- [ ] Gỡ `noindex` ở prod (và CHỈ prod); `robots.txt` + `sitemap.xml` đúng domain
- [ ] hreflang/canonical kiểm tra bằng vài URL thật; JSON-LD pass Rich Results Test
- [ ] Lighthouse (mobile) ≥ 90 Performance, ≥ 95 SEO; OG image hiển thị đúng khi share
- [ ] Google Search Console: verify domain, submit sitemap; `llms.txt` truy cập được

### E.3 Quy trình release prod bằng tag

```
main (đã chạy ổn trên staging vài ngày)
  → git tag v1.0.0 && git push --tags
  → workflow deploy-prod.yml:
      - PROMOTE đúng image sha đang chạy ở staging (không rebuild!)
      - retag ghcr:sha → ghcr:v1.0.0
      - environment: production (bật "required reviewers" → bấm Approve)
      - ssh prod: pull → migrate → up -d --wait → smoke test
```

Rollback = chạy lại workflow với tag cũ (`v0.9.x`) — một thao tác, <2 phút.

### E.4 Ngày launch (runbook)

| Giờ | Việc |
|---|---|
| T-0 | Deploy giờ thấp điểm (sáng sớm). Tag `v1.0.0`, approve, theo dõi workflow |
| +10' | Smoke test: trang chủ từng locale, login, 1 flow nghiệp vụ chính, `/healthz`, Swagger |
| +30' | Kiểm tra Sentry (0 error mới), p95 latency, log không có warning lạ |
| +1h | Search Console submit sitemap; test share link (OG) trên Zalo/Facebook |
| +24h | Soát Sentry + uptime + Core Web Vitals thực (CrUX); backup đêm đầu chạy đúng |
| +48h | Nếu ổn: khóa phiên bản, retro ngắn, quay lại nhịp task bình thường |

### E.5 Sau go-live — nhịp vận hành

- Merge main → **staging tự động** (như cũ). Prod **chỉ** lên bằng tag `v*` — mỗi tuần 1–2 lần, gom nhiều task đã test kỹ trên staging.
- Mỗi release prod có ghi chú ngắn (tự sinh từ commit messages nhờ Conventional Commits).
- Hàng tháng: restore drill backup + xem lại Dependabot/Trivy alerts.

---

## Tóm tắt dòng chảy hằng ngày sau khi mọi thứ vận hành

```
Issue → nhánh feat/… → code local (docker compose dev + pnpm dev)
      → XONG TASK = push + PR (trong ngày, dở dang thì Draft PR)
      → CI xanh → squash merge vào main
      → staging TỰ deploy sau ~5 phút → test trên staging.<domain>
      → gom vài task ổn định → tag v* → APPROVE → prod
```
