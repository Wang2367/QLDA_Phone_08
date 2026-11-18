# PhoneFlow Nhóm 5

PhoneFlow 2.0 dùng React, Express và SQL Server cho chuỗi cửa hàng điện thoại tại Hà Nội. Web và Mobile Web dùng chung API, phiên đăng nhập, chứng từ và sổ tồn.

## Chạy trên máy Windows

Cần Node.js 22.12 trở lên, SQL Server và ODBC Driver 18. Cấu hình đã kiểm tra trên máy hiện tại là localhost\SQLEXPRESS với Windows Authentication.

    npm ci
    npm run db:setup
    npm run build
    npm start

Web mở tại http://127.0.0.1:3001 và Mobile tại http://127.0.0.1:3001/mobile. Có thể chạy scripts/start.ps1 từ PowerShell để thực hiện các bước trên. Backend phải tiếp tục chạy khi dùng Web/Mobile.

db:setup tạo database PhoneFlow khi chưa có, áp migration và seed dữ liệu khi bảng người dùng rỗng. Chạy lại giữ dữ liệu hiện có. File sql/001_schema.sql có thể xem trong SSMS. Script scripts/setup-db.mjs chứa dữ liệu mẫu và cách khởi tạo mật khẩu băm.

Sao chép .env.example thành .env khi cần thay DB_SERVER, DB_NAME, PORT hoặc HOST. Mặc định kết nối bằng Windows Authentication qua ODBC 18. DB_CONNECTION_STRING có thể chỉ định chuỗi kết nối riêng. Giữ .env tại máy chạy.

## Tài khoản dữ liệu mẫu

Mật khẩu khởi tạo mặc định cho các tài khoản là PhoneFlow@123, hoặc SEED_PASSWORD nếu được đặt trước lần seed đầu tiên.

| Tài khoản | Vai trò | Chi nhánh |
| --- | --- | --- |
| quang | Quản trị, toàn bộ nghiệp vụ | Cả 5 |
| cong | Thủ kho, nhập/xuất, kiểm kê, gửi/nhận hàng | Cả 5 |
| tuan | Hậu mãi và bảo hành | Cả 5 |
| quanly.hk | Quản lý, duyệt đổi trả/điều chuyển/kiểm kê | Hoàn Kiếm |
| thungan.hk | Bán hàng và hóa đơn | Hoàn Kiếm |

Quang có quyền kiểm tra toàn chuỗi. Quyền chính thức do máy chủ kiểm tra ở từng lệnh. Người dùng kho gửi phiếu, quản lý hoặc Quang thực hiện phê duyệt.

## Trình diễn sản phẩm

1. Đăng nhập quang. Chọn Hoàn Kiếm, nhập kho một máy có serial mới và hai IMEI 15 chữ số.
2. Tra lần lượt hai IMEI trong Sản phẩm hoặc Mobile. Cả hai dẫn tới cùng một thiết bị.
3. Vào POS, chọn máy theo IMEI. Thử thanh toán thất bại rồi thành công. Mở hóa đơn và đối chiếu trạng thái đã bán.
4. Vào Bảo hành, tra hóa đơn/IMEI, xem điều kiện và ngày hết hạn rồi tiếp nhận, xử lý, hoàn tất.
5. Tạo phiếu đổi trả, duyệt và nhận hàng lỗi vào cách ly.
6. Nhập phụ kiện, tạo/duyệt/xuất phiếu điều chuyển. Đổi chi nhánh sang nơi nhận, lập biên bản nếu lệch rồi đối soát và nhận.
7. Mở /mobile, quét kiểm kê, lưu nháp khi mô phỏng mất mạng, kết nối và gửi duyệt. Quản lý duyệt tại Kho → Kiểm kê hoặc Mobile → Phiếu đếm.
8. Nếu tồn đã thay đổi sau khi đếm, máy chủ từ chối duyệt phiếu cũ. Đối chiếu lại hàng và lập phiếu mới.

Các chứng từ dùng SQL Server. Thiết lập giao diện và nháp kiểm kê dùng trình duyệt. Các dữ liệu mẫu Nhóm 4 lưu trong localStorage được giữ ở bản prototype Nhóm 4; seed Nhóm 5 tạo bộ dữ liệu SQL riêng.

## Mobile trên điện thoại cùng mạng

Trong PowerShell tại thư mục ứng dụng, đặt HOST cho lần chạy đó.

    $env:HOST = '0.0.0.0'
    npm start

Dùng địa chỉ IPv4 của máy chạy Backend với cổng 3001, ví dụ http://192.168.1.10:3001/mobile. Điện thoại và máy chủ cần cùng mạng và cổng phải được hệ điều hành cho phép. Lần bàn giao này đã kiểm tra Mobile Web trên trình duyệt desktop với kích thước điện thoại. Kiểm tra trực tiếp trên thiết bị của nhóm được ghi vào bàn giao Nhóm 6.

## Phát triển và kiểm tra

    npm run api
    npm run dev

Hai lệnh chạy ở hai terminal. Vite chuyển /api đến Backend cổng 3001.

    npm test
    node scripts/check-runtime.mjs

npm test chạy kiểm tra API/SQL trên database PhoneFlow đang cấu hình và tạo các chứng từ kỹ thuật có tiền tố TECH. Có thể cấu hình DB_NAME riêng và chạy db:setup trước khi thử. check-runtime ghi số liệu tại docs/runtime-evidence.json.

Tài liệu API, truy vết yêu cầu, kết quả kiểm tra và điều kiện bàn giao nằm trong docs. Thanh toán sử dụng kết quả mô phỏng theo phạm vi học phần.

