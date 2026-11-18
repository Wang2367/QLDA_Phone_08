# Kết quả rà soát API A12

Ngày 18/11/2026, đối chiếu nhận xét đánh giá mã nguồn Nhóm 5 với route và truy vấn SQL hiện hành.

## Phát hiện và xử lý

Nhận xét đúng: route GET /reports/:type không truyền r.params.type; hàm reports cũ luôn trả daily, balances và warranty. Vì vậy bốn đường dẫn không tạo được bốn báo cáo độc lập.

Đã chuyển truy vấn sang server/reports.js và truyền type từ route. sales trả doanh thu/đơn paid theo hai kỳ; inventory trả tồn hiện tại theo SKU; in-transit trả hàng chưa nhận của phiếu moving/review theo hai chiều; warranty trả phiếu tiếp nhận trong kỳ và số lượng theo trạng thái. Các truy vấn giới hạn theo chi nhánh đã được cấp quyền.

Kỳ báo cáo dùng ngày lịch UTC+7, đủ số ngày, đầu kỳ bao gồm và cuối kỳ loại trừ. Dashboard lấy current/previous và khoảng ngày từ API, giữ daily cho biểu đồ, chia đúng các nhóm ngày ở kỳ 7/30/90. Hai báo cáo ảnh chụp inventory/in-transit không loại phiếu cũ còn đang chuyển. Chi tiết hợp đồng và cách hiểu days nằm trong API.md.

## Kiểm chứng

Chạy API nguồn ở cổng 3002, kết nối database PhoneFlow trên localhost\SQLEXPRESS. Lệnh kiểm tra:

```powershell
$env:TEST_BASE_URL = 'http://127.0.0.1:3002/api/v1'
npm test
npm run build
```

Kết quả: 19 bài đạt, 0 lỗi; Vite build thành công. technical-checks.txt lưu đầu ra npm test thực tế. Trong đó kiểm tra A12 gồm:

- Mốc đầu/cuối kỳ, kỳ trước, giao ngày UTC+7 và năm nhuận.
- Tổng biểu đồ không mất doanh thu ở kỳ 7, 30, 90 ngày.
- Doanh thu chỉ lấy đơn paid trong đúng kỳ/chi nhánh, đối chiếu tổng SQL.
- Tồn khả dụng không bị cộng hàng đang chuyển; cộng riêng đi/đến và đối chiếu SQL.
- Phiếu moving/review có phần chưa nhận; loại pending/received và phiếu không thuộc chi nhánh; đếm phiếu duy nhất.
- Phiếu bảo hành theo ngày tiếp nhận, tổng từng trạng thái và tổng SQL.
- Loại sai/days sai trả 422; thiếu phiên trả 401; thiếu quyền hoặc sai chi nhánh trả 403.

Bộ dữ liệu A12 dùng ID ngẫu nhiên, chỉ dọn đúng các ID đã tạo trong finally, không thay đổi số dư kho. Bộ hồi quy nghiệp vụ hiện có tiếp tục tạo chứng từ TECH để truy vết. Kết quả là kiểm tra kỹ thuật; UAT và kiểm tra thiết bị thật vẫn theo hồ sơ bàn giao Nhóm 6.
