# Nhật ký vấn đề và việc bàn giao

| Mã | Nội dung | Trạng thái | Minh chứng hoặc bước tiếp |
| --- | --- | --- | --- |
| FIX-01 | Gửi hai đơn bán cùng thiết bị | Đã kiểm tra | Một đơn thành công, một xung đột; transaction SQL |
| FIX-02 | Gửi lại thanh toán/nhận chuyển | Đã kiểm tra | Idempotency-Key trả kết quả cũ, sổ tồn ghi một lần |
| FIX-03 | Trùng IMEI khi nhập | Đã kiểm tra | Unique và rollback cả thiết bị/phiếu |
| FIX-04 | Duyệt kiểm kê sau khi tồn thay đổi | Đã kiểm tra | So revision/số dư, trả 409 và yêu cầu lập phiếu mới |
| FIX-05 | Phân quyền chỉ trên UI của prototype | Đã hiện thực máy chủ | API middleware kiểm tra role/branch mỗi request |
| FIX-06 | A12 bỏ qua loại báo cáo, trả chung một cấu trúc | Đã sửa và kiểm tra | server/reports.js; tests/reports.test.mjs; A12_REVIEW.md; bộ kiểm tra 19 đạt/0 lỗi |
| QA-01 | UAT và Test Report chính thức | Nhóm 6 tiếp nhận | Theo Test Plan và điều kiện nghiệm thu học phần |
| QA-02 | Điện thoại Android thật và truy cập LAN | Chờ kiểm tra trên thiết bị nhóm | Chạy HOST=0.0.0.0 và kiểm tra mạng/cổng theo README |
| QA-03 | Thông lượng ghi đồng thời | Nhóm 6 đánh giá thêm | Sổ tồn hiện tuần tự hóa transaction; số đo lookup chỉ đo luồng đọc |
| QA-04 | FR-08.2, NFR-05, NFR-06 | Should ngoài đợt đã chốt | Xuất báo cáo, uptime/backup/restore theo quyết định phạm vi tiếp theo |
| PM-01 | Chữ ký và xác nhận bàn giao 5.9 | Chờ nhóm xác nhận | Dùng bảng trong HANDOVER.md |
| PM-02 | Cập nhật Microsoft Project | Chờ đối chiếu file .mpp hiện hành | Kiểm tra Resource Names, Work, predecessor, Duration và minh chứng mỗi WBS |

