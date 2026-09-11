# Ghi chú khởi chạy Kimmy Systems

Cập nhật: 11/09/2026. Các lệnh dưới đây chạy trong **PowerShell**.

## 1. Khởi chạy hằng ngày trên máy hiện tại

Mở Terminal/PowerShell và chạy:

```powershell
cd D:\Projects\kimmy-systems
powershell -ExecutionPolicy Bypass -File scripts/start-local-postgres.ps1
npx --yes pnpm@9.15.9 dev
```

- Lệnh đầu chọn thư mục dự án.
- Lệnh thứ hai khởi động PostgreSQL portable; nếu đã chạy thì giữ nguyên.
- Lệnh cuối khởi động **API và web cùng lúc**, tự tải lại khi sửa mã nguồn.
- Giữ cửa sổ terminal mở trong khi làm việc. Chờ API báo `Nest application successfully started` và web báo `Ready`.
- Không cần cài dependency, migrate hoặc seed lại mỗi lần mở máy.
- Nếu dự án đang chạy nền từ phiên làm việc trước, dùng ngay các địa chỉ bên dưới; không chạy thêm một phiên dev trên cùng cổng.

## 2. Các địa chỉ cần nhớ

| Mục đích | Địa chỉ trên máy hiện tại |
| --- | --- |
| Kimmy tiếng Việt | http://kimmyphungmakeup.localhost:3000/ |
| Kimmy tiếng Anh | http://kimmyphungmakeup.localhost:3000/en |
| Giới thiệu tiếng Việt | http://kimmyphungmakeup.localhost:3000/gioi-thieu |
| Giới thiệu tiếng Anh | http://kimmyphungmakeup.localhost:3000/en/about |
| Site Demo | http://demo.localhost:3000/ |
| Alias của site Kimmy | http://localhost:3000 |
| Swagger, xem và thử API | http://localhost:4001/docs |
| Kiểm tra API còn hoạt động | http://localhost:4001/healthz |

Ngôn ngữ mặc định dùng URL không prefix: `/` và `/gioi-thieu`. URL cũ `/vi` hoặc `/vi/gioi-thieu` tự chuyển hướng 301 sang bản không prefix. Tiếng Anh giữ `/en/...`. Ngôn ngữ browser không tự thay đổi URL.

Demo hiện chỉ có nội dung tiếng Việt; `/en` trả 404 là đúng. Domain chưa đăng ký, ví dụ `khac.localhost`, cũng trả 404.

## 3. Cấu hình riêng trên máy này

| Thành phần | Cấu hình |
| --- | --- |
| Thư mục dự án | `D:\Projects\kimmy-systems` |
| Web | Cổng `3000` |
| API | Cổng `4001`, vì LocalWP đang dùng `4000` |
| PostgreSQL | `127.0.0.1:5432` |
| Database phát triển | `kimmysystem` |
| Database integration test | `kimmysystem_test` |
| Dữ liệu PostgreSQL portable | `.local/pgdata` |
| File cấu hình API | `apps/api/.env` |
| File cấu hình web | `apps/web/.env` |

Hai giá trị phải khớp:

```dotenv
# apps/api/.env: chỉnh dòng PORT, giữ nguyên các dòng khác
PORT=4001

# apps/web/.env
API_URL=http://localhost:4001/api/v1
```

Docker Desktop chưa chạy được trên máy này do WSL2/ảo hóa chưa khả dụng. Hiện API và web dùng PostgreSQL portable. Redis, MinIO và Mailpit chưa chạy local; không cần chúng cho các trang đọc dữ liệu của Phase 0.

`.env.example` trong Git dùng cổng API mặc định **4000**. Nếu tạo lại `.env` trên máy này, nhớ chỉnh hai dòng trên về **4001**. Không ghi đè toàn bộ `.env` API bằng riêng dòng `PORT`.

## 4. Dừng dự án

**Nếu chạy trong terminal:** bấm `Ctrl+C` tại terminal đang chạy `dev`. Chờ tiến trình dừng rồi mới khởi động lại.

**Nếu đang chạy nền do phiên triển khai ban đầu tạo:** có thể dừng đúng cây tiến trình đã ghi trong `.local/dev.pid` bằng đoạn sau. Đoạn lệnh kiểm tra đường dẫn launcher trước khi dừng, để tránh dùng nhầm PID cũ:

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

Đoạn trên dành riêng cho launcher nền đã được tạo trên máy này, không dùng trên máy clone mới. Sau đó có thể chạy lại theo mục 1 trong terminal để dễ xem log và dừng bằng `Ctrl+C`.

PostgreSQL vẫn chạy sau khi dừng API/web. Nếu muốn dừng cả PostgreSQL, dừng API/web trước rồi chạy:

```powershell
& .local/postgres/pgsql/bin/pg_ctl.exe -D .local/pgdata stop -m fast
```

Lệnh này dừng database, **không xóa dữ liệu**. Không xóa `.local/pgdata` để xử lý lỗi khởi động.

## 5. Sau khi tải mã mới từ Git

Dừng API/web trước khi đổi nhánh, pull, cài dependency hoặc build. Điều này tránh lỗi watcher và khóa file Prisma trên Windows.

```powershell
cd D:\Projects\kimmy-systems
git pull --ff-only
npx --yes pnpm@9.15.9 install --frozen-lockfile
powershell -ExecutionPolicy Bypass -File scripts/start-local-postgres.ps1
npx --yes pnpm@9.15.9 db:deploy
npx --yes pnpm@9.15.9 dev
```

`db:deploy` áp dụng migration đã có trong Git. Nếu Git báo có thay đổi local, giữ lại thay đổi của bạn và xử lý trước; không dùng reset để bỏ qua.

Chỉ chạy seed khi cần tạo hoặc khôi phục **nội dung mẫu**:

```powershell
npx --yes pnpm@9.15.9 db:seed
```

Seed có thể chạy lặp mà không tạo bản ghi trùng, nhưng sẽ cập nhật lại nội dung các bản ghi mẫu. Không chạy seed mỗi ngày nếu đang sửa những nội dung đó trong database.

## 6. Kiểm thử trước khi gửi thay đổi

Dừng phiên dev trước; giữ PostgreSQL đang chạy. Database `kimmysystem_test` đã được tạo và migrate trên máy này.

```powershell
cd D:\Projects\kimmy-systems
npx --yes pnpm@9.15.9 turbo lint typecheck test build
npx --yes pnpm@9.15.9 exec tsc --noEmit -p tsconfig.e2e.json
npx --yes pnpm@9.15.9 test:integration
$env:E2E_API_PORT='4001'
npx --yes pnpm@9.15.9 test:e2e
Remove-Item Env:E2E_API_PORT
```

Nếu một lệnh lỗi, xử lý lỗi đó trước khi chạy tiếp. Playwright tự khởi động production server cần thiết khi cổng trống. Khi test xong, khởi động dev lại theo mục 1.

- Nếu báo thiếu trình duyệt: chạy `npx --yes pnpm@9.15.9 exec playwright install chromium`.
- Xem báo cáo trình duyệt: `npx --yes pnpm@9.15.9 exec playwright show-report`.
- Khi có migration mới, database test cũng cần migrate. Xem mục **Kiểm thử** trong [README](README.md) để trỏ tạm `DATABASE_URL` vào database `_test` rồi khôi phục.
- Kết quả nghiệm thu Phase 0: [báo cáo kiểm thử](docs/phase-0-verification.md).

## 7. Kiểm tra nhanh khi không mở được trang

**API có chạy không?**

```powershell
Invoke-RestMethod http://localhost:4001/healthz
```

Kết quả bình thường có `status: ok`. Nếu không kết nối được, xem terminal API và khởi động PostgreSQL trước.

**Cổng nào đang bị chiếm?**

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,4001,5432 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

Tra tiến trình theo `OwningProcess` bằng `Get-Process -Id <PID>`. Không tắt hàng loạt `node.exe` hoặc ứng dụng LocalWP để giải phóng cổng.

| Hiện tượng | Cách xử lý |
| --- | --- |
| `EADDRINUSE` | Đã có một phiên chạy hoặc ứng dụng khác dùng cổng; kiểm tra PID trước |
| Lỗi pnpm/version hoặc yêu cầu xóa `node_modules` | Dùng `npx --yes pnpm@9.15.9 ...` như các lệnh trong note |
| Web trả 503 | Kiểm tra API cổng 4001, PostgreSQL và `API_URL` |
| `Invalid environment` | Kiểm tra tên biến được báo lỗi trong `.env` của API |
| `Cannot read ... tsconfig.build.json` sau đổi nhánh | Dừng launcher dev cũ rồi chạy lại sau khi Git hoàn tất |
| Lỗi Prisma `EPERM` khi install/build | Dừng API/dev đang chạy rồi thử lại |
| Sửa dữ liệu nhưng trang chưa đổi | Cache dữ liệu có TTL 60 giây; chờ rồi tải lại |
| Domain `.localhost` không mở được | Thử Chrome/Edge và kiểm tra dev đã báo `Ready` |

Log của phiên chạy nền ban đầu nằm ở `.local/dev.log`, `.local/dev-error.log`; log PostgreSQL ở `.local/postgres.log`. Phiên chạy trực tiếp theo mục 1 hiển thị log ngay trong terminal.

## 8. Khi chuyển sang máy mới hoặc Docker

Thư mục `.local` và `.env` **không có trong Git**. Máy clone mới không có PostgreSQL portable đã chuẩn bị trên máy này. Dùng hướng dẫn **Chạy từ checkout mới** trong [README](README.md).

Khi Docker/WSL2 đã hoạt động trên máy hiện tại:

1. Dừng API/web và PostgreSQL portable để nhường cổng 5432.
2. Chạy `npx --yes pnpm@9.15.9 infra:up`.
3. Chạy `npx --yes pnpm@9.15.9 db:deploy` và seed nếu database Docker còn mới.
4. Chạy `npx --yes pnpm@9.15.9 dev`.

Database Docker và database portable là **hai nơi lưu dữ liệu khác nhau**. Nếu cần giữ nội dung đã chỉnh, phải backup/restore khi chuyển; các lệnh trên không tự chuyển dữ liệu.

Sau khi dừng API/web, có thể dừng hạ tầng Docker bằng `npx --yes pnpm@9.15.9 infra:down`. Không thêm `-v` nếu muốn giữ dữ liệu trong volume.
