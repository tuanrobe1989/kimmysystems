# Ghi chú khởi chạy Kimmy Systems

Cập nhật: 11/09/2026. Các lệnh dưới đây chạy trong **PowerShell**.

> Note này dành riêng cho **máy hiện tại** (cấu hình đặc thù ở mục 3). Máy khác dùng README.
> Mỗi mục có phần **Vì sao** — hiểu lý do thì gặp tình huống lạ sẽ tự xử được thay vì làm theo máy móc.

## 0. Hai điều đặc thù của máy này (đọc trước)

1. **Không có Docker** — WSL2/ảo hóa chưa khả dụng, nên PostgreSQL chạy bản **portable** trong `.local/postgres`, dữ liệu ở `.local/pgdata`. Redis/MinIO/Mailpit chưa chạy — Phase 0 chỉ đọc dữ liệu nên không cần chúng; sang Phase 1 (email, rate-limit) sẽ cần giải pháp thay thế hoặc bật được Docker.
2. **API dùng cổng 4001 thay vì 4000** — vì ứng dụng LocalWP đang chiếm cổng 4000. Mọi chỗ trong note này viết 4001; `.env.example` trong Git vẫn là 4000 (chuẩn chung của repo, không sửa file example theo máy mình).

**Vì sao mọi lệnh dùng `npx --yes pnpm@9.15.9 ...` thay vì `pnpm ...`:** máy này chưa cài pnpm global ổn định; `npx` tải và chạy đúng phiên bản **9.15.9** khớp với trường `packageManager` trong package.json. Nhờ đó mọi người/máy/CI dùng cùng một phiên bản pnpm — tránh nhóm lỗi "khác version pnpm nên lockfile/cấu trúc node_modules khác nhau".

## 1. Khởi chạy hằng ngày

```powershell
cd D:\Projects\kimmy-systems
powershell -ExecutionPolicy Bypass -File scripts/start-local-postgres.ps1
npx --yes pnpm@9.15.9 dev
```

- Lệnh 1: vào thư mục dự án.
- Lệnh 2: khởi động PostgreSQL portable. **Vì sao có `-ExecutionPolicy Bypass`:** Windows mặc định chặn chạy file `.ps1`; flag này chỉ nới cho đúng một lệnh, không đổi cấu hình hệ thống. Script tự kiểm tra: nếu Postgres đã chạy thì giữ nguyên, chạy lặp vô hại.
- Lệnh 3: `dev` chạy qua Turborepo → khởi động **API và web cùng lúc**, tự tải lại khi sửa code. Chờ API báo `Nest application successfully started` và web báo `Ready`.
- **Vì sao không cần install/migrate/seed mỗi ngày:** dependency chỉ đổi khi `pnpm-lock.yaml` đổi; schema DB chỉ đổi khi có migration mới trong Git; dữ liệu đã nằm sẵn trong `.local/pgdata`. Chạy lại các bước đó hằng ngày chỉ tốn thời gian (và seed còn ghi đè dữ liệu — xem mục 5).
- **Vì sao không mở phiên dev thứ hai:** hai tiến trình không thể cùng nghe một cổng → phiên sau chết với lỗi `EADDRINUSE`. Nếu nghi ngờ đang có phiên chạy nền từ trước, kiểm tra cổng (mục 7) trước khi chạy `dev`.

### Chạy riêng API và web (khi cần đọc log tách bạch)

**Vì sao:** `turbo dev` trộn log hai app vào một cửa sổ; khi debug một phía, log riêng dễ đọc hơn hẳn. Dùng cách này **thay cho** lệnh `dev` chung, mở hai terminal và giữ cả hai:

```powershell
# Terminal 1 — database + API
cd D:\Projects\kimmy-systems
powershell -ExecutionPolicy Bypass -File scripts/start-local-postgres.ps1
npx --yes pnpm@9.15.9 --filter @kimmy/api dev
```

```powershell
# Terminal 2 — web
cd D:\Projects\kimmy-systems
npx --yes pnpm@9.15.9 --filter @kimmy/web dev
```

`--filter @kimmy/api` = chỉ chạy đúng package đó trong monorepo. API cổng **4001**, web cổng **3000**. Dừng: `Ctrl+C` ở từng terminal.

### Build và chạy bản production local

**Vì sao cần chế độ này:** bản dev ưu tiên tốc độ sửa code (không tối ưu, có overhead hot-reload); bản production build tối ưu thật — dùng khi muốn đo hiệu năng thực, tái hiện lỗi "chỉ xảy ra trên production", hoặc kiểm tra trước khi release. Trade-off: **không tự tải lại khi sửa code** — sửa gì phải build lại.

```powershell
# Dừng các phiên dev trước (tránh trùng cổng), rồi:
cd D:\Projects\kimmy-systems
powershell -ExecutionPolicy Bypass -File scripts/start-local-postgres.ps1
npx --yes pnpm@9.15.9 build
```

```powershell
# Terminal 1 — API đã build
npx --yes pnpm@9.15.9 --filter @kimmy/api start
```

```powershell
# Terminal 2 — web đã build
npx --yes pnpm@9.15.9 --filter @kimmy/web start
```

Đây là bản production chạy trên máy cá nhân, chưa publish. Quay về dev: dừng cả hai rồi chạy lại mục 1.

### Kiểm tra sau khi start

```powershell
Invoke-RestMethod http://localhost:4001/healthz
(Invoke-WebRequest http://localhost:3000/healthz -UseBasicParsing).StatusCode
Start-Process 'http://kimmyphungmakeup.localhost:3000/'
```

API trả `status: ok`, web trả `200`, lệnh cuối mở trang tiếng Việt. **Vì sao kiểm tra bằng `/healthz` thay vì mở trang luôn:** healthz trả lời trong mili-giây và tách bạch được "API sống không" khỏi "trang render đúng không" — trang lỗi mà healthz ok thì vấn đề nằm ở web/dữ liệu, không phải API chết.

## 2. Các địa chỉ cần nhớ

| Mục đích | Địa chỉ |
| --- | --- |
| Kimmy tiếng Việt | http://kimmyphungmakeup.localhost:3000/ |
| Kimmy tiếng Anh | http://kimmyphungmakeup.localhost:3000/en |
| Giới thiệu tiếng Việt | http://kimmyphungmakeup.localhost:3000/gioi-thieu |
| Giới thiệu tiếng Anh | http://kimmyphungmakeup.localhost:3000/en/about |
| Site Demo | http://demo.localhost:3000/ |
| Alias của site Kimmy | http://localhost:3000 |
| Swagger — xem và thử API | http://localhost:4001/docs |
| Kiểm tra API sống | http://localhost:4001/healthz |

**Vì sao `.localhost` mở được mà không cần cài gì:** chuẩn quy định `*.localhost` luôn trỏ về máy mình; Chrome/Edge/Firefox tự xử lý, nên `kimmyphungmakeup.localhost` không cần sửa file hosts. Đây là cách test multi-site (nhiều domain → một app) ngay trên máy.

**Vì sao ngôn ngữ mặc định không có `/vi` trong URL:** mỗi trang chỉ nên có **một** URL chính thức — nếu cả `/` và `/vi` cùng hiện một nội dung, Google coi là trùng lặp và chia điểm SEO. Vì vậy: tiếng Việt (mặc định) dùng URL trần (`/`, `/gioi-thieu`); URL cũ `/vi/...` tự chuyển hướng **301** (chuyển hướng vĩnh viễn — Google dồn điểm về URL mới) sang bản không prefix; tiếng Anh giữ `/en/...`. Ngôn ngữ browser **không** tự đổi URL — nếu tự đổi, bot của Google (mặc định tiếng Anh) sẽ không bao giờ thấy bản tiếng Việt.

Demo hiện chỉ có tiếng Việt → `/en` trả 404 là **đúng** (site nào khai locale nấy). Domain chưa đăng ký (vd `khac.localhost`) trả 404 là đúng.

## 3. Cấu hình riêng trên máy này

| Thành phần | Cấu hình | Vì sao |
| --- | --- | --- |
| Thư mục dự án | `D:\Projects\kimmy-systems` | |
| Web | Cổng `3000` | Mặc định của repo |
| API | Cổng `4001` | **LocalWP đang chiếm 4000** trên máy này |
| PostgreSQL | `127.0.0.1:5432` | Cổng chuẩn Postgres |
| DB phát triển | `kimmysystem` | |
| DB integration test | `kimmysystem_test` | Test **xóa sạch dữ liệu** mỗi lần chạy — phải là DB riêng, không bao giờ trỏ test vào DB dev |
| Dữ liệu Postgres portable | `.local/pgdata` | `.local` không nằm trong Git — dữ liệu là của riêng máy này |
| Cấu hình API / web | `apps/api/.env`, `apps/web/.env` | `.env` chứa giá trị theo máy, không commit; chỉ `.env.example` nằm trong Git |

Hai giá trị phải khớp nhau (API nghe ở đâu, web gọi đến đó):

```dotenv
# apps/api/.env — chỉnh dòng PORT, giữ nguyên các dòng khác
PORT=4001

# apps/web/.env
API_URL=http://localhost:4001/api/v1
```

**Vì sao không ghi đè toàn bộ `.env` bằng một dòng `PORT`:** API validate env lúc khởi động (bằng zod) — thiếu bất kỳ biến nào (`DATABASE_URL`, `S3_KEY`…) là API **từ chối chạy** với lỗi `Invalid environment`. Đây là chủ đích: thà chết ngay với thông báo rõ, còn hơn chạy nửa vời rồi lỗi khó hiểu ở chỗ khác. Nếu tạo lại `.env` từ `.env.example`, nhớ chỉnh lại 2 dòng cổng về 4001.

## 4. Dừng dự án

**Chạy trong terminal:** `Ctrl+C` tại terminal đang chạy `dev`, **chờ tiến trình dừng hẳn** rồi mới khởi động lại. Vì sao phải chờ: watcher và server cần vài giây nhả cổng + nhả khóa file; khởi động đè lên khi chưa nhả xong sẽ dính `EADDRINUSE` hoặc khóa file Prisma.

**Đang chạy nền (launcher tạo từ phiên triển khai ban đầu):** dừng đúng cây tiến trình ghi trong `.local/dev.pid`:

```powershell
cd D:\Projects\kimmy-systems
$devLauncherId = [int](Get-Content .local/dev.pid)
$devLauncher = Get-CimInstance Win32_Process -Filter "ProcessId=$devLauncherId"
$expectedLauncher = (Resolve-Path .local/run-dev.ps1).Path
if ($devLauncher -and $devLauncher.CommandLine -like "*$expectedLauncher*") {
  taskkill /PID $devLauncherId /T /F
} else {
  Write-Host 'Không tìm thấy launcher phù hợp. Kiểm tra cổng trước khi dừng tiến trình khác.'
}
```

**Vì sao script kiểm tra CommandLine trước khi kill:** PID được hệ điều hành **tái sử dụng** — PID cũ trong file có thể giờ đang là một chương trình khác. Kiểm tra đường dẫn launcher khớp rồi mới kill là để không bao giờ giết nhầm tiến trình lạ. `/T` = kill cả cây con (node của api + web), `/F` = buộc dừng. Đoạn này chỉ dùng trên máy này (máy clone mới không có `.local/run-dev.ps1`).

**Dừng cả PostgreSQL** (bình thường không cần — Postgres chạy nền rất nhẹ):

```powershell
& .local/postgres/pgsql/bin/pg_ctl.exe -D .local/pgdata stop -m fast
```

`-m fast` = ngắt kết nối hiện có rồi dừng **sạch** (checkpoint đầy đủ), không mất dữ liệu. **Tuyệt đối không xóa `.local/pgdata` để "sửa" lỗi khởi động** — đó là toàn bộ database của bạn.

## 5. Sau khi tải mã mới từ Git

**Dừng API/web trước khi đổi nhánh/pull/install/build.** Vì sao: trên Windows, tiến trình đang chạy **khóa file** nó dùng — dev watcher giữ file build, API giữ engine của Prisma. Pull/install khi đang chạy sẽ dính lỗi `EPERM`, watcher trỏ vào file đã đổi, hoặc build hỏng nửa chừng.

```powershell
cd D:\Projects\kimmy-systems
git pull --ff-only
npx --yes pnpm@9.15.9 install --frozen-lockfile
powershell -ExecutionPolicy Bypass -File scripts/start-local-postgres.ps1
npx --yes pnpm@9.15.9 db:deploy
npx --yes pnpm@9.15.9 dev
```

Vì sao từng lệnh:

- `--ff-only`: chỉ pull khi lịch sử thẳng hàng; nếu máy có commit/thay đổi local chưa đẩy, Git dừng lại cho bạn xử lý thay vì tự trộn ra kết quả bất ngờ. **Không dùng reset để "cho nhanh"** — reset vứt thay đổi local không lấy lại được.
- `install --frozen-lockfile`: cài **đúng từng byte** theo `pnpm-lock.yaml`, không tự nâng version. Máy bạn và CI vì thế giống hệt nhau; lockfile lệch là báo lỗi thay vì âm thầm khác đi.
- `db:deploy` (= `prisma migrate deploy`): **áp** các migration đã có trong Git lên DB local, không tạo migration mới. Khác với `db:migrate` (= `migrate dev`) là lệnh dành cho lúc **bạn đang sửa schema**. Sau khi pull code người khác thì luôn dùng `deploy`.

Seed — chỉ chạy khi cần tạo/khôi phục **nội dung mẫu**:

```powershell
npx --yes pnpm@9.15.9 db:seed
```

**Vì sao không seed mỗi ngày:** seed là **upsert** — chạy lặp không tạo bản ghi trùng, nhưng sẽ **ghi đè nội dung các bản ghi mẫu về trạng thái gốc**. Nếu bạn đang chỉnh nội dung đó trong DB (qua admin sau này), seed sẽ xóa công sức của bạn.

## 6. Kiểm thử trước khi gửi thay đổi

Dừng phiên dev trước (test production build cần cổng trống); giữ PostgreSQL chạy. DB `kimmysystem_test` đã được tạo và migrate trên máy này.

```powershell
cd D:\Projects\kimmy-systems
npx --yes pnpm@9.15.9 turbo lint typecheck test build
npx --yes pnpm@9.15.9 exec tsc --noEmit -p tsconfig.e2e.json
npx --yes pnpm@9.15.9 test:integration
$env:E2E_API_PORT='4001'
npx --yes pnpm@9.15.9 test:e2e
Remove-Item Env:E2E_API_PORT
```

Vì sao chuỗi này:

- Chạy đúng thứ tự **rẻ trước, đắt sau** (lint vài giây → e2e vài phút): lỗi được phát hiện sớm nhất có thể. Một lệnh đỏ thì sửa xong mới chạy tiếp — chạy tiếp trên nền lỗi chỉ ra thêm lỗi nhiễu.
- Đây chính là những gì **CI sẽ chạy trên PR** — chạy local trước để không phải chờ CI báo đỏ rồi sửa vòng lại (mỗi vòng mất 5–10 phút).
- **Vì sao integration test dùng DB `_test` riêng:** test xóa sạch dữ liệu trước khi chạy (`deleteMany`). File `test/setup.ts` có chốt an toàn: từ chối chạy nếu tên DB không kết thúc bằng `_test` — không bao giờ trỏ được test vào DB dev.
- `E2E_API_PORT=4001`: bảo Playwright khởi động API test ở cổng 4001 (khớp máy này). Playwright tự khởi động production server khi cổng trống.

Tiện ích:

- Thiếu trình duyệt: `npx --yes pnpm@9.15.9 exec playwright install chromium`.
- Xem báo cáo e2e: `npx --yes pnpm@9.15.9 exec playwright show-report`.
- Có migration mới → DB `_test` cũng phải migrate (xem mục Kiểm thử trong [README](README.md)).
- Kết quả nghiệm thu Phase 0: [docs/phase-0-verification.md](docs/phase-0-verification.md).

## 7. Kiểm tra nhanh khi không mở được trang

Chẩn đoán theo tầng, **từ dưới lên** (DB → API → web) — tầng dưới chết thì tầng trên chết theo, kiểm tra từ dưới lên là tìm được gốc rễ nhanh nhất:

```powershell
# 1. API sống không? (kéo theo: Postgres sống không?)
Invoke-RestMethod http://localhost:4001/healthz
```

```powershell
# 2. Cổng nào đang bị ai chiếm?
Get-NetTCPConnection -State Listen -LocalPort 3000,4001,5432 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

Tra tiến trình: `Get-Process -Id <PID>`. **Vì sao không tắt hàng loạt `node.exe`:** máy này còn LocalWP và các app khác cũng chạy node — kill hàng loạt sẽ giết nhầm chúng. Luôn tra PID → xác nhận đúng tiến trình của dự án → mới dừng.

| Hiện tượng | Nguyên nhân & cách xử lý |
| --- | --- |
| `EADDRINUSE` | Cổng đã có tiến trình nghe (phiên dev cũ, hoặc app khác). Tra PID rồi xử lý đúng tiến trình — đừng đoán |
| Lỗi pnpm/version, đòi xóa `node_modules` | Đang chạy pnpm sai phiên bản → luôn dùng `npx --yes pnpm@9.15.9 ...` như trong note |
| Web trả 503 | Web sống nhưng gọi API thất bại → kiểm tra API 4001, Postgres, và `API_URL` trong `apps/web/.env` |
| `Invalid environment` | Zod chặn boot vì `.env` thiếu/sai biến — đọc tên biến trong thông báo lỗi, sửa đúng biến đó |
| `Cannot read ... tsconfig.build.json` sau đổi nhánh | Watcher cũ trỏ file đã bị Git thay — dừng launcher dev cũ, chờ Git xong, chạy lại |
| Prisma `EPERM` khi install/build | File engine đang bị API/dev khóa (đặc thù Windows) — dừng API/dev rồi thử lại |
| Sửa dữ liệu nhưng trang chưa đổi | Không phải bug: web cache dữ liệu **TTL 60 giây** (đổi tốc độ lấy độ trễ) — chờ rồi tải lại |
| `.localhost` không mở được | Dùng Chrome/Edge; kiểm tra dev đã báo `Ready` chưa |

Log phiên chạy nền: `.local/dev.log`, `.local/dev-error.log`; log Postgres: `.local/postgres.log`:

```powershell
Get-Content .local/dev.log -Tail 60
Get-Content .local/dev-error.log -Tail 60
Get-Content .local/postgres.log -Tail 40
```

## 8. Khi chuyển sang máy mới hoặc Docker

`.local` và `.env` **không nằm trong Git** (chủ đích: dữ liệu + cấu hình là của riêng từng máy). Máy clone mới không có Postgres portable — dùng mục **Chạy từ checkout mới** trong [README](README.md).

Khi Docker/WSL2 hoạt động được trên máy này:

1. Dừng API/web **và Postgres portable** — vì sao: Postgres trong Docker cũng cần cổng 5432, hai bên không thể cùng nghe.
2. `npx --yes pnpm@9.15.9 infra:up` — bật Postgres/Redis/MinIO/Mailpit trong Docker.
3. `npx --yes pnpm@9.15.9 db:deploy`, và seed nếu DB Docker còn trống.
4. `npx --yes pnpm@9.15.9 dev`.

**Vì sao phải backup/restore nếu muốn giữ dữ liệu:** DB portable (`.local/pgdata`) và DB trong Docker volume là **hai nơi lưu trữ hoàn toàn khác nhau** — các lệnh trên không tự chuyển dữ liệu giữa hai bên. Dừng hạ tầng Docker: `infra:down` (không thêm `-v` — flag `-v` xóa luôn volume, tức xóa dữ liệu).
