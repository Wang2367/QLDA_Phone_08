# API PhoneFlow 2.0

Tiền tố /api/v1. JSON UTF-8. Dùng cookie phoneflow_sid HttpOnly để xác thực. Login và logout dùng cùng origin. Cookie được lưu phía trình duyệt, bản băm phiên và hạn 8 giờ lưu tại SQL Server.

API nghiệp vụ gửi X-Branch-ID. Máy chủ đối chiếu quyền chi nhánh và vai trò. Request POST/PATCH nghiệp vụ cần Idempotency-Key, chuỗi tối đa 100 ký tự. Cùng user, method, đường dẫn, khóa và nội dung trả lại kết quả đã ghi. Khác nội dung với cùng khóa trả 409.

Các danh sách trả mảng JSON; bootstrap trả đối tượng gồm products, devices, quantities, orders, services, movements, transfers, counts, balances, branches. Tiền lưu decimal VND, số lượng nguyên, ID chuỗi, thời gian UTC ISO 8601. Các thao tác tạo trả HTTP 200 cùng đối tượng kết quả; logout trả 204.

| Nhóm | Phương thức và đường dẫn | Quyền |
| --- | --- | --- |
| A01 | POST /auth/login, POST /auth/logout | Đăng nhập/phiên |
| A02 | GET /me/permissions | Phiên |
| A03 | GET/POST /products, GET/POST /skus, PATCH /skus/{id} | Đọc trong phiên, ghi catalog |
| A04 | GET/POST /devices, PATCH /devices/{id}/identifiers | Ghi catalog, đăng ký nhập máy cần stock |
| A05 | GET/POST /receipts, POST /receipts/{id}/confirm | stock |
| A06 | GET /inventory, GET /inventory/movements | Đọc tồn trong phiên; lịch sử cần stock |
| A07 | GET/POST /sales, POST /sales/{id}/confirm | sale |
| A08 | POST /returns, POST /returns/{id}/approve, POST /returns/{id}/receive | aftercare, duyệt cần approve |
| A09 | GET /warranty/eligibility?q=, GET/POST /warranty/policies, GET/POST /warranty/tickets, POST /warranty/tickets/{id}/events | aftercare; ghi chính sách cần catalog |
| A10 | GET/POST /transfers, POST /transfers/{id}/approve, /dispatch, /discrepancies, /reconcile, /receive | stock; duyệt/đối soát cần approve |
| A11 | GET /lookup?q= | Phiên và chi nhánh |
| A12 | GET /reports/{type}?days=7 | reports |
| A13 | GET /audit-events | audit |
| A14 | GET/POST /counts, POST /counts/{id}/submit, POST /counts/{id}/approve | stock; duyệt cần approve |
| Tích hợp | GET /bootstrap, GET /health | Phiên/chi nhánh; health công khai trạng thái kết nối |

POST /devices đăng ký thiết bị và xác nhận nhập kho trong một transaction, với serial/imeis và chi nhánh hiện hành. Định danh của máy có lịch sử bán được giữ để truy vết. Sửa danh mục có active=false sẽ ngừng sử dụng SKU và giữ dữ liệu đã phát sinh.

POST /receipts nhận productId, qty cho phụ kiện hoặc serial, imeis cho điện thoại, cùng type và note. Có thể gửi lines để ghi nhiều dòng. Xác nhận phiếu mới ghi tồn. Tạo lại request confirm cùng khóa không ghi lặp.

## Ví dụ bán hàng

POST /sales

    {
      "customer": "Khách lẻ",
      "lines": [
        { "productId": "7", "qty": 2 }
      ]
    }

Máy chủ trả id, status=draft, giá và total từ danh mục. Điện thoại dùng deviceId và qty=1. POST /sales/{id}/confirm nhận method là Tiền mặt, Chuyển khoản hoặc Thẻ, và result là success hoặc failure. Kết quả success có invoiceNo, status=paid và lines. Failure trả 422, giữ đơn draft và tồn.

## Ví dụ điều chuyển

POST /transfers

    {
      "to": "q3",
      "productId": "7",
      "qty": 2,
      "note": "Bổ sung hàng Ba Đình"
    }

Tạo/duyệt/xuất ở chi nhánh nguồn. Nhận tại chi nhánh đích, quyền kiểm tra ở máy chủ. /discrepancies và /reconcile nhận note. Mỗi lần báo lệch lưu một biên bản; chỉ nhận khi các biên bản đã có kết luận.

## Ví dụ kiểm kê

POST /counts

    {
      "note": "Kiểm kê Mobile",
      "rows": [
        { "productId": "7", "expected": 38, "revision": 0, "count": 37, "devices": [] }
      ]
    }

expected và revision lấy từ GET /inventory hoặc /lookup tại lúc bắt đầu đếm. Điện thoại có danh sách devices là ID duy nhất đã quét. Sau tạo, gửi /submit rồi quản lý gọi /approve với note. Máy chủ so lại revision và số dư khi tạo cũng như khi duyệt. Thiết bị thiếu chuyển cách ly để xác minh sau phê duyệt.

## Bảo hành và đổi trả

/eligibility trả các dòng bán phù hợp, policyId, coverage, exclusions, expiresAt, eligible và reason. Phiếu mới nhận orderId, lineIndex và reason. API máy chủ xác nhận thời hạn/chứng từ trước khi tiếp nhận; hậu mãi xác nhận lỗi có thuộc chính sách.

Phiếu bảo hành tiến từ received → processing → done. /events nhận next và note. Thiết bị đang xử lý đổi sang warranty; khi hoàn tất trở lại sold.

Đổi trả tiến pending → approved → returned. Khi nhận, condition là available hoặc quarantine. Máy chủ giới hạn tổng số trả theo dòng bán. Hàng đang có phiếu bảo hành mở cần hoàn tất trước khi nhận trả.

## A12 – Báo cáo

GET /reports/{type}?days=7 nhận cookie phiên và X-Branch-ID. Cần quyền reports tại chi nhánh được chọn. type chỉ nhận sales, inventory, in-transit hoặc warranty; loại khác trả 422. days mặc định 7, nhận một số nguyên từ 1 đến 90; giá trị rỗng, lặp tham số, thập phân hoặc ngoài khoảng trả 422.

Mọi kết quả có type, branchId, asOf (UTC ISO 8601) và timeZone=Asia/Bangkok (UTC+7, cùng giờ Việt Nam). Kỳ tính theo ngày lịch UTC+7, gồm hôm nay và days−1 ngày trước. period.from/to là ngày YYYY-MM-DD bao gồm hai đầu; truy vấn dùng startUtc bao gồm và endUtc loại trừ. previousPeriod của sales có cùng số ngày và kết thúc ngay trước kỳ hiện tại.

| type | Trường kết quả riêng | Quy tắc dữ liệu |
| --- | --- | --- |
| sales | days, period, previousPeriod, daily, current, previous | Đơn paid của chi nhánh trong hai kỳ. daily gồm day (YYYY-MM-DD), total, orders; chỉ có ngày phát sinh. current/previous gồm total và orders, bằng 0 nếu không phát sinh. |
| inventory | items, totals | Ảnh chụp tồn hiện tại theo SKU, gồm cả SKU đã ngừng sử dụng còn dữ liệu. Điện thoại đếm thiết bị; phụ kiện lấy stock_balances. |
| in-transit | items, totals | Dòng hàng còn chưa nhận của phiếu moving/review mà chi nhánh là nguồn hoặc đích. Bao gồm phiếu xuất từ trước kỳ. |
| warranty | days, period, items, byStatus, totals | Phiếu có ngày tiếp nhận trong kỳ; thống kê trạng thái hiện tại received, processing, done của những phiếu đó. |

inventory.items có productId, sku, name, category, active, available, quarantine, inWarranty, movingOut, movingIn. totals cộng năm trường số lượng. Hàng đang chuyển tính qty−receivedQty, tách đi/đến, không cộng vào available. inWarranty là số thiết bị đang có trạng thái warranty.

in-transit.items có transferId, lineId, fromBranch, toBranch, fromName, toName, status, date, productId, sku, productName, deviceId, qtySent, receivedQty, remainingQty và direction (outgoing/incoming). totals gồm documents (số phiếu duy nhất), remainingQty, outgoingQty, incomingQty.

warranty.items có id, status, reason, date, createdBy, saleLineId, policyId, orderId, productId, deviceId, productName, sku, customer. byStatus là mảng {status,count}; totals gồm tickets, received, processing, done. Đây là báo cáo theo ngày tiếp nhận, không phải toàn bộ tồn đọng bảo hành trước kỳ.

days được kiểm tra hợp lệ cho cả bốn loại; inventory và in-transit luôn phản ánh thời điểm hiện tại, không áp bộ lọc ngày và không trả period. Dashboard dùng sales.daily cùng current/previous; tồn khả dụng và bảo hành đang mở trên Dashboard vẫn là chỉ số hiện tại từ bootstrap. A12 chỉ trả JSON trong phạm vi hiện tại.

## Lỗi

Phản hồi dạng {"error":{"code":"BUSINESS_ERROR","message":"…"},"requestId":"…"}.

401 cần đăng nhập, 403 thiếu quyền hoặc sai chi nhánh, 404 đối tượng/mã không tìm thấy trong phạm vi, 409 trùng hoặc trạng thái/số dư thay đổi, 422 dữ liệu không hợp lệ, 429 giới hạn thử đăng nhập, 500 lỗi máy chủ. Client giữ nội dung form, hiển thị thông báo và khóa nút trong lúc gửi.

Giao dịch ghi được tuần tự hóa bằng sp_getapplock trên sổ tồn và chạy SERIALIZABLE, XACT_ABORT ON. Khóa này bảo đảm đúng dữ liệu khi có nhiều process API cùng kết nối; triển khai quy mô lớn cần đánh giá lại thông lượng ghi ở Nhóm 6.

