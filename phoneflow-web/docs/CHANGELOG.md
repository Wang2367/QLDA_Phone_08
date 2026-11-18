# Nhật ký thay đổi Nhóm 5

## 18/11/2026

| Mã | Thay đổi | Căn cứ và tác động |
| --- | --- | --- |
| CR-5-01 | Chuyển dữ liệu nghiệp vụ từ trình duyệt sang SQL Server và REST API | Kế hoạch Nhóm 5 đã được người dùng yêu cầu triển khai |
| CR-5-02 | Bổ sung kiểm kê có phê duyệt FR-03.3 và nhận hàng/kiểm kê Mobile FR-07.3 | Người dùng chọn “Must và luồng Mobile”; hai yêu cầu Should được nhận vào đợt triển khai này |
| CR-5-03 | Mobile Web có đường dẫn /mobile riêng | Người dùng chọn Mobile Web làm sản phẩm bàn giao |
| CR-5-04 | Giữ năm chi nhánh Hà Nội theo mã nguồn workspace hiện hành | Hoàn Kiếm, Ba Đình, Cầu Giấy, Đống Đa, Hà Đông; bản Nhóm 5 bàn giao theo cấu hình này |
| CR-5-05 | Tạo database PhoneFlow riêng và dùng Windows Authentication | Đã kiểm tra localhost\\SQLEXPRESS, tránh phụ thuộc tài khoản SQL nhập tay |
| CR-5-06 | Dùng /api/v1, cookie phiên và các đường dẫn A01–A14 | Thống nhất hợp đồng API trong API.md; bổ sung trường revision kiểm kê và khóa yêu cầu |
| FIX-5-07 | Sửa A12 bỏ qua type; tách sales, inventory, in-transit, warranty | Phản hồi đánh giá mã nguồn; bổ sung hợp đồng, kiểm tra SQL và quyền; Dashboard lấy kỳ UTC+7 từ API |

Các ID quyết định Q-01–Q-07 trong hồ sơ yêu cầu được giữ. Các thao tác kỹ thuật thử nghiệm tạo chứng từ và audit có thể truy vết trong SQL Server.

