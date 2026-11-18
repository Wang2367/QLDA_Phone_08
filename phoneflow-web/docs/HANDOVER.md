# Hồ sơ bàn giao phát triển Nhóm 5

Ngày kiểm tra kỹ thuật 18/11/2026. Dự án PHONE-IMS-01, phiên bản PhoneFlow 2.0. Người rà soát của nhóm gồm Quang, Công và Tuấn. Phần xác nhận bàn giao do các thành viên ghi khi thực hiện rà soát.

## Kết quả phát triển theo WBS

| WBS | Sản phẩm đã hiện thực | Minh chứng |
| --- | --- | --- |
| 5.1 | Express, SQL Server, schema, seed, phiên, quyền vai trò/chi nhánh | server/db.js, auth.js, index.js; sql/001_schema.sql; kiểm tra quyền |
| 5.2 | Danh mục SKU, sửa/ngừng sử dụng, thiết bị đa IMEI và ràng buộc duy nhất | Sản phẩm; API A03/A04; tests dual IMEI |
| 5.3 | Nhập/xuất, số dư, sổ tồn, kiểm kê và phê duyệt | Kho, Counts; API A05/A06/A14 |
| 5.4 | Đơn nháp, xác nhận thanh toán, hóa đơn, đổi trả và cách ly | POS, Hậu mãi; kiểm tra race/payment/return |
| 5.5 | Chính sách hiệu lực, tra điều kiện, phiếu và lịch sử bảo hành | Chính sách bảo hành; API A09 |
| 5.6 | Duyệt/xuất/nhận chuyển, biên bản và đối soát | Kho → Điều chuyển; kiểm tra chuyển giữa q1/q3 |
| 5.7 | Mobile Web /mobile, tra API, đếm, lưu nháp, gửi duyệt và nhận chuyển | src/mobile.jsx, counts.jsx, kiểm tra giao diện Mobile |
| 5.8 | Dashboard từ SQL, tích hợp Web/API/Mobile và build | dist, API reports, runtime-evidence.json |
| 5.9 | Mã nguồn, SQL, hướng dẫn, kiểm tra kỹ thuật và hồ sơ bàn giao | README, API, HANDOVER, CHANGELOG, ISSUES, technical-checks.txt |

Trạng thái là hoàn thành bản tích hợp và kiểm tra kỹ thuật sơ bộ. Mốc 5.9 chờ nhóm rà soát và xác nhận bàn giao. Tiến độ, nguồn lực và ngày tháng Microsoft Project cần đối chiếu file .mpp của nhóm.

## Truy vết yêu cầu

| Mã | Hiện thực | Kiểm chứng sơ bộ |
| --- | --- | --- |
| FR-01.1 | A01 phiên đăng nhập SQL và logout | API authorization/logout, UI login |
| FR-01.2 | A02 middleware quyền từng chi nhánh | Tài khoản thu ngân bị từ chối ở Ba Đình |
| FR-02.1 | Danh mục products/skus và sửa/ngừng sử dụng | A03; kiểm tra sửa giá, ngừng sử dụng và giữ hóa đơn cũ |
| FR-02.2 | devices/device_imeis, IMEI duy nhất, serial duy nhất | Nhập hai IMEI, chặn trùng và rollback |
| FR-02.3 | Trạng thái từ giao dịch, audit và sổ tồn | Bán, chuyển, cách ly, bảo hành |
| FR-03.1 | receipts và receipt_lines xác nhận giao dịch | Nhập hợp lệ và nhập trùng |
| FR-03.2 | stock_balances và stock_movements | Đối chiếu sổ tồn với số dư SQL |
| FR-03.3 | stock_counts và count_lines | Mở rộng đã chốt, duyệt và phát hiện phiếu cũ |
| FR-04.1 | Đơn có thiết bị hoặc SKU/số lượng | POS giao diện và API |
| FR-04.2 | Đơn draft, paid, invoiceNo | Thanh toán lỗi giữ tồn, thành công xuất hóa đơn |
| FR-04.3 | Transaction kiểm tra lại IMEI và số dư | Hai đơn cùng máy và bán vượt tồn |
| FR-05.1 | Chính sách lưu phiên bản theo dòng bán | eligibility theo hóa đơn và IMEI |
| FR-05.2 | warranty_tickets/warranty_events | Lịch sử tiếp nhận–xử lý–hoàn tất |
| FR-05.3 | returns/return_events và phân loại hàng | Duyệt, cách ly và chặn trả quá số lượng |
| FR-06.1 | transfers/transfer_lines | Quyền nguồn/đích, trạng thái duyệt |
| FR-06.2 | Xuất chuyển và trạng thái moving | Tồn nguồn giảm, tồn đích chưa tăng |
| FR-06.3 | Biên bản và nhận hợp lệ | Chặn nhận khi chưa đối soát, gửi lặp nhận một lần |
| FR-07.1 | Mobile dùng phiên và quyền SQL | Kiểm tra phiên sau restart |
| FR-07.2 | Tra cứu API theo IMEI/SKU/serial | Hai IMEI tra cùng thiết bị |
| FR-07.3 | Kiểm kê và nhận chuyển Mobile | Mở rộng đã chốt; nháp offline, gửi và duyệt |
| FR-08.1 | SQL reports và Dashboard | Đối chiếu tổng SQL, lọc kỳ/chi nhánh |
| FR-08.2 | Theo dõi Should | Ngoài đợt triển khai đã chốt |
| NFR-01 | Chỉ mục IMEI/SKU/serial, connection pool | 30 yêu cầu lookup đồng thời, số đo trong runtime-evidence.json |
| NFR-02 | Scrypt, phiên HttpOnly, kiểm tra quyền máy chủ | Sai quyền/chi nhánh và hết phiên |
| NFR-03 | Unique, transaction, idempotency | Race, duplicate, rollback, repeat confirmation |
| NFR-04 | audit_events, lịch sử phiếu | Người, thời điểm, đối tượng và hành động tại SQL |
| NFR-05 | Theo dõi Should | Uptime và backup hằng ngày chuyển sang phạm vi sau |
| NFR-06 | Theo dõi Should | RPO/RTO chuyển sang phạm vi sau |
| NFR-07 | React responsive, tiếng Việt, Mobile Web | Kiểm tra desktop và Mobile rộng 390 px, không tràn ngang; UAT/thiết bị thật tại Nhóm 6 |
| NFR-08 | API chung, bản nháp riêng theo user/chi nhánh | Nháp mất mạng, server kiểm tra revision và khóa yêu cầu |

## Minh chứng đã quan sát

Web đã chạy chuỗi nhập G5-UI-001 có IMEI 869000000000101 và 869000000000102, tạo hóa đơn HD-10023, tra chính sách và tạo phiếu BH-10025. Mobile tra đúng thiết bị đã bán, lưu nháp kiểm kê khi mô phỏng mất mạng và gửi KK-10026 lên SQL Server. Phiếu điều chuyển DC-10047 được tạo/xuất ở Web và nhận tại Ba Đình bằng Mobile. Phiếu KK-10026 bị từ chối duyệt khi tồn đã phát sinh sau lúc đếm, đúng kiểm soát revision.

Sau khi khởi động lại Backend, Mobile vẫn dùng phiên và tra được thiết bị G5-UI-001 từ SQL. Sau lần rà soát A12, bộ kiểm tra có 19 bài đạt, 0 lỗi; đầu ra thực tế lưu trong technical-checks.txt. Bốn loại báo cáo A12 được tách riêng, kiểm tra mốc ngày UTC+7, số lượng đang chuyển, trạng thái bảo hành và quyền chi nhánh; xem A12_REVIEW.md. Đo 30 lookup đồng thời trước đó đạt P95 179 ms trên cùng máy Windows, Node 24.14.1 và SQL Server Express 17.0.1145.4 tại thời điểm ghi runtime-evidence.json.

Các số đo là kiểm tra kỹ thuật trên máy hiện tại. Nhóm 6 tiếp nhận Test Plan, kiểm thử tích hợp đầy đủ, kiểm thử trên thiết bị thật, UAT và kết luận chất lượng.

## Xác nhận của nhóm

| Thành viên | Nội dung rà soát | Ngày và xác nhận |
| --- | --- | --- |
| Quang | Web/POS/Dashboard, phạm vi và hồ sơ bàn giao | Chờ nhóm điền |
| Công | SQL Server, API, dữ liệu và giao dịch | Chờ nhóm điền |
| Tuấn | Mobile, kiểm tra và truy vết yêu cầu | Chờ nhóm điền |

Kết luận bàn giao và mốc 5.9 chờ xác nhận của nhóm. Hồ sơ kỹ thuật hiện có là đầu vào cho buổi rà soát này.

