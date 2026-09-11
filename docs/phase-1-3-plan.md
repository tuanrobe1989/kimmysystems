# Sau Phase 0 — Kế hoạch Phase 1→3 & cơ chế phát triển Admin + Page Builder

> Phase 0 đã xong (multi-site + i18n + default locale chạy local, CI xanh).
> Tài liệu này trả lời: **làm gì tiếp theo**, và **cơ chế phát triển admin/builder vận hành thế nào**.
> Nhịp không đổi: 1 task = 1 Issue = 1 nhánh = 1 PR, push trong ngày.
> Liên quan: [system-design.md](./system-design.md) · [rollout-plan.md](./rollout-plan.md) · [phase-0-local.md](./phase-0-local.md)

## Bức tranh tổng: thứ tự và vì sao thứ tự đó

```
Phase 1  Auth + Core API      ← làm TRƯỚC admin: admin không có auth thì không tồn tại
   │     (+ dựng STAGING song song — rollout-plan giai đoạn D)
Phase 2  Content + SEO        ← trang public "ra tiền" trước, builder làm đẹp sau
Phase 3  Admin + Page Builder ← xây trên auth (P1) + content model (P2)
Phase 4  Mobile + Hardening
```

**Lý do:** Page builder ghi vào `page_translations.content` — cột đã có sẵn từ Phase 0. Nhưng *ai được ghi* (auth/RBAC — Phase 1) và *ghi rồi hiển thị + SEO ra sao* (render pipeline — Phase 2) phải có trước. Đi tắt đến builder là xây tầng 3 khi chưa có tầng 1–2.

---

## Phase 1 — Auth + Core API (tuần 2–4)

| Task | Nhánh | Nội dung | DoD |
|---|---|---|---|
| T1.1 | `feat/user-model-register` | Model `User`, `Session`; đăng ký + đăng nhập email/password, băm **Argon2id** | Đăng ký qua Swagger, password trong DB là hash argon2 |
| T1.2 | `feat/jwt-refresh-rotation` | Access JWT 10–15', refresh **rotation** lưu bảng `Session` (hash), **reuse detection** → thu hồi cả chuỗi | Test integration: dùng lại refresh cũ → mọi session của chuỗi bị revoke |
| T1.3 | `feat/rbac-per-site` | `Role`, `UserSiteRole (userId, siteId, role)`; guard `@RequirePermission('page.publish')` đọc từ decorator | User site A không đụng được resource site B (test chứng minh) |
| T1.4 | `feat/web-auth-cookie` | Web: login form, token trong cookie `httpOnly+Secure+SameSite`, CSRF cho mutation, refresh tự động | Đăng nhập trên web, F5 vẫn giữ phiên, XSS không đọc được token |
| T1.5 | `feat/security-baseline` | Helmet + CSP, rate-limit Redis (per-IP + per-token, trả `429 + Retry-After`), CORS whitelist đọc từ bảng `SiteDomain` | Spam login bị 429; origin lạ bị chặn CORS |
| T1.6 | `feat/bullmq-email` | BullMQ + worker; email verify + reset password (dev bắt bằng Mailpit) | Email retry khi lỗi; thấy trong Mailpit `:8025` |
| T1.7 | `feat/oidc-google` | Social login Google (OIDC); Apple lùi sang Phase 4 khi làm app | Login Google end-to-end trên local |
| T1.8 | `chore/api-client-package` | `packages/api-client`: sinh TS client từ OpenAPI spec (script `pnpm gen:client`); web chuyển sang dùng client này | Web không còn `fetch` viết tay; spec đổi → typecheck web bắt được |

> **Song song Phase 1:** dựng **staging** theo rollout-plan giai đoạn D (VPS + Traefik + deploy-staging.yml). Từ đó mọi PR merge là có link staging cho người khác test — đừng đợi xong Phase 1.

## Phase 2 — Content + SEO (tuần 4–8)

| Task | Nhánh | Nội dung | DoD |
|---|---|---|---|
| T2.1 | `feat/post-model` | Model `Post` + `PostTranslation` (đúng pattern Page); CRUD API có phân quyền | Tạo/sửa bài qua Swagger với đúng role |
| T2.2 | `feat/web-post-pages` | Trang list + detail bài viết per locale, ISR | Bài viết seed hiển thị cả 2 site |
| T2.3 | `feat/seo-structured-data` | JSON-LD (`Organization`, `WebSite`, `Article`, `BreadcrumbList`) sinh từ dữ liệu API | Pass Google Rich Results Test |
| T2.4 | `feat/sitemap-hreflang` | `sitemap.xml` động per site per locale (URL theo quy tắc default-locale-không-prefix), `robots.txt` per site | Sitemap đúng URL trần cho vi, `/en/...` cho en |
| T2.5 | `feat/og-images` | OG image động (`next/og`) per trang per locale | Share link ra ảnh đúng title |
| T2.6 | `feat/revalidate-webhook` | API publish/unpublish → job BullMQ gọi endpoint revalidate của web (`revalidateTag('page:<id>')`, ký HMAC) | Publish → trang public đổi trong <10s, không rebuild |
| T2.7 | `feat/llms-txt` | `llms.txt` + RSS per site | Truy cập được ở cả 2 domain |
| T2.8 | `chore/lighthouse-ci` | Lighthouse CI vào pipeline: Performance ≥ 90, SEO ≥ 95 là gate | PR làm tụt điểm bị CI đỏ |

> T2.6 là **khớp nối quan trọng nhất** — nó là đường ống mà Phase 3 dùng lại nguyên vẹn: builder bấm Publish cũng chỉ là bắn đúng webhook này.

## Phase 3 — Admin + Page Builder (tuần 8–12)

### 3.1 Cơ chế cốt lõi: MỘT registry, HAI nơi render

```
packages/ui/blocks/                        ← NGUỒN SỰ THẬT DUY NHẤT
├─ hero/
│  ├─ Hero.tsx          # React component (server-render được)
│  ├─ schema.ts         # zod schema props + version
│  └─ puck.ts           # cấu hình hiển thị trong editor (label, fields, default props)
├─ rich-text/ …  gallery/ …  faq/ …  cta/ …
└─ registry.ts          # gom tất cả: { hero: {...}, faq: {...} }

apps/web    → BlockRenderer đọc registry → render cây JSON server-side (SSR/ISR, SEO đầy đủ)
apps/admin  → Puck editor đọc CÙNG registry → kéo thả, preview đúng 100% như web
```

**Vòng đời một trang:**

```
Editor kéo thả trong admin (Puck)
   → cây JSON [{type:"hero", props:{…}}, {type:"faq", props:{…}}]
   → Lưu nháp:  PUT /pages/:id/translations/:locale/draft   (chưa ảnh hưởng public)
   → Preview:   web Draft Mode render bản nháp bằng đúng BlockRenderer
   → Publish:   POST /pages/:id/publish
                 ├─ chép draft → content chính thức
                 ├─ ghi PageRevision (bản cũ để rollback)
                 └─ job BullMQ → revalidate webhook (T2.6) → live sau vài giây
   → Rollback:  POST /pages/:id/revisions/:rev/restore = publish lại bản cũ
```

### 3.2 Cơ chế phát triển: thêm một block mới = một PR theo khuôn

Đây là "nhịp phát triển builder" lặp đi lặp lại về sau — mỗi block là một task độc lập:

1. Tạo thư mục `packages/ui/blocks/<ten-block>/` với đúng 3 file (component, schema zod + `version: 1`, cấu hình puck).
2. Đăng ký vào `registry.ts` — **admin tự thấy block mới trong editor, web tự render được nó**, không sửa gì thêm ở hai app.
3. Component phải: server-render được (không `useState` trừ phần client cô lập), lấy màu/font từ **theme tokens của site** (không hardcode brand), tự sinh JSON-LD nếu là block ngữ nghĩa (FAQ → `FAQPage`).
4. Test: snapshot render + validate schema. PR theo nhịp thường lệ.

**Đổi schema block đã có** → tăng `version` + viết hàm `migrate(props_cũ) → props_mới` trong `schema.ts`; BlockRenderer chạy migrate khi gặp version cũ → **trang cũ không bao giờ vỡ**, không cần migration DB.

### 3.3 Task breakdown Phase 3

| Task | Nhánh | Nội dung | DoD |
|---|---|---|---|
| T3.1 | `feat/admin-scaffold` | `apps/admin` (Next.js, port 3001), login qua API (cookie flow T1.4), chỉ role admin/editor vào được | Đăng nhập, thấy danh sách site được gán |
| T3.2 | `feat/admin-crud` | CRUD sites/domains/locales + pages/posts + bản dịch (form thường, chưa builder) | Tạo site thứ 3 hoàn toàn từ UI, không đụng DB |
| T3.3 | `feat/block-registry` | `packages/ui` + 4 block đầu: Hero, RichText, Image, CTA + `BlockRenderer`; **web chuyển sang render `content` bằng registry** | Trang seed render qua BlockRenderer, HTML/SEO không đổi |
| T3.4 | `feat/puck-editor` | Gắn Puck vào admin, load/save draft qua API | Kéo thả 4 block, lưu nháp, reload còn nguyên |
| T3.5 | `feat/draft-preview` | Next.js Draft Mode: nút Preview mở đúng trang web render bản nháp | Nháp xem được, public chưa đổi |
| T3.6 | `feat/publish-revisions` | Bảng `PageRevision`; flow publish → revision → revalidate (nối T2.6); UI rollback | Publish live <10s; rollback 1 click |
| T3.7 | `feat/media-library` | Upload ảnh lên MinIO/R2 (presigned URL), thư viện media trong admin, picker gắn vào block props | Chèn ảnh vào Hero từ thư viện |
| T3.8 | `feat/blocks-round-2` | Block FAQ (tự sinh JSON-LD), Gallery, Form (nối BullMQ email) — mỗi block một PR theo khuôn 3.2 | Editor dựng được landing page hoàn chỉnh |

**Nghiệm thu Phase 3:** một người **không biết code** đăng nhập admin → dựng trang mới bằng kéo thả → preview → publish → trang live đúng brand của site, Lighthouse SEO ≥ 95, và rollback được.

### 3.4 Ranh giới trách nhiệm (giữ hệ thống sạch lâu dài)

| Thành phần | Được làm | Không được làm |
|---|---|---|
| `apps/admin` | UI quản trị, gọi API | Đụng DB trực tiếp, chứa logic nghiệp vụ |
| `packages/ui` | Block component + schema + registry | Gọi API, biết gì về admin/Puck ngoài file `puck.ts` |
| `apps/api` | Nguồn sự thật: validate cây block bằng zod schema của registry trước khi lưu | Render UI |
| `apps/web` | Render registry + SEO | Ghi dữ liệu |

> API **validate cây JSON bằng đúng zod schema của block** trước khi lưu — admin gửi gì cũng không thể nhét block rác hay props sai kiểu vào DB.

---

## Việc nên làm ngay tuần này

1. **T1.1 + T1.2** (auth lõi) — mở đường cho mọi thứ phía sau.
2. **Dựng staging** (rollout-plan §D) song song — 1 buổi, để merge nào cũng có link test thật.
3. Merge các PR Dependabot đang treo (đặc biệt security bump) theo nhịp mỗi tuần.
