# Đối chiếu Microsoft Project cho Nhóm 5

Các giá trị Duration và tiền nhiệm dưới đây lấy từ kế hoạch Nhóm 5 người dùng cung cấp. Đối chiếu bản .mpp hiện hành trước khi nhập. Mỗi dòng Notes ghi phiên bản PhoneFlow 2.0, mã nguồn và kết quả kiểm tra tương ứng.

| WBS | Duration tham chiếu | Predecessor WBS | Notes bàn giao |
| --- | --- | --- | --- |
| 5.1 | 7 ngày | 4.4 | Backend Express, SQL Server PhoneFlow, schema/seed và xác thực vai trò–chi nhánh đã kiểm tra |
| 5.2 | 7 ngày | 5.1 | Danh mục, SKU, thiết bị đa IMEI, sửa/ngừng sử dụng và dữ liệu lịch sử |
| 5.3 | 8 ngày | 5.2 | Nhập/xuất, sổ tồn, kiểm kê có duyệt và kiểm tra tồn thay đổi |
| 5.4 | 9 ngày | 5.2, 5.3 | POS, đơn nháp, hóa đơn sau thanh toán, đổi trả và cách ly |
| 5.5 | 7 ngày | 5.4 | Chính sách hiệu lực, tiếp nhận và lịch sử bảo hành |
| 5.6 | 7 ngày | 5.3 | Tạo/duyệt/xuất/đối soát/nhận điều chuyển, chống ghi lặp |
| 5.7 | 9 ngày | 5.1, 5.3, 5.6 | Mobile Web /mobile, tra API, nháp offline, kiểm kê và nhận chuyển |
| 5.8 | 8 ngày | 5.4, 5.5, 5.6, 5.7 | Bản tích hợp React/API/SQL, Dashboard và build |
| 5.9 | 0 ngày | 5.8 | Hồ sơ kỹ thuật đã đóng gói, chờ nhóm xác nhận bàn giao sang Nhóm 6 |

Trong Project, đối chiếu Resource Names, Work và quá tải nguồn lực với phân công Quang–Công–Tuấn. Chỉ cập nhật % Complete sau khi nhóm kiểm tra minh chứng. Mốc 5.9 giữ Duration 0 ngày và điền ngày xác nhận khi nhóm hoàn tất biên bản HANDOVER.md.

Lịch thực hiện mã nguồn ngày 18/11/2026 thuộc công việc chuẩn bị sản phẩm học phần. Các ngày dự án 01/01–05/03/2027 là lịch mô phỏng tham chiếu. File .mpp chưa được sửa trong đợt bàn giao mã nguồn này.

