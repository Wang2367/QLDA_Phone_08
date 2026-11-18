# PhoneFlow

Prototype Web cho WBS 4.2 của dự án PHONE-IMS-01. Mã nguồn dùng React, Vite và CSS thuần. Giao diện hiển thị tiếng Việt và dùng dữ liệu mô phỏng của 5 chi nhánh.

## Chạy trên máy

Cần Node.js 20.19+ hoặc 22.12+.

    npm ci
    npm run dev

Mở địa chỉ Vite in ra trong terminal, thường là http://127.0.0.1:5173. Chạy npm run build để tạo thư mục dist và npm run preview để xem bản build.

Có thể mở dist/PhoneFlow.html trực tiếp trong trình duyệt để trình diễn. Tạo lại bản HTML tự chứa bằng npm run demo sau khi sửa mã nguồn.

## Màn hình Web và Mobile

| Mã | Đường dẫn | Luồng demo |
| --- | --- | --- |
| W01 | #/dang-nhap | Kiểm tra dữ liệu mẫu và thông báo đăng nhập sai |
| W02 | #/tong-quan | Lọc kỳ báo cáo, chọn chi nhánh, xem hóa đơn |
| W03 | #/san-pham | Lọc danh mục, thêm SKU, tra hai IMEI cùng thiết bị |
| W04 | #/pos | Chọn thiết bị hoặc phụ kiện, lập đơn và thử thanh toán |
| W05 | #/kho | Nhập/xuất kho, duyệt, xuất, đối soát và nhận điều chuyển |
| W06 | #/hau-mai | Tra hóa đơn/IMEI, tạo phiếu, xem lịch sử bảo hành và đổi trả |
| M01–M03 | #/mobile | Đăng nhập Android, tra IMEI/SKU/serial, đối chiếu kiểm kê và thử trạng thái mất mạng |

Trang đầu mở sẵn phiên quản lý mẫu. Có thể đăng xuất trong menu tài khoản để xem W01. Tài khoản mẫu là demo, mật khẩu phoneflow. Dữ liệu thay đổi lưu trong localStorage trên trình duyệt đang dùng. Đăng nhập, phân quyền, thanh toán và nghiệp vụ đều là mô phỏng phía trình duyệt.

Mở **Mobile Android** ở menu để vào khung điện thoại M01–M03. Dùng nút **Điền tài khoản mẫu** và **Điền mã mẫu** để thử nhanh. Kiểm kê chỉ lưu bản nháp trên trình duyệt, theo từng chi nhánh.

## Luồng trình diễn

1. Tại Quản lý kho, nhập một điện thoại với serial mới và hai IMEI 15 chữ số khác nhau.
2. Vào Sản phẩm và tìm lần lượt hai IMEI. Mở sản phẩm để xem hai mã thuộc cùng thiết bị.
3. Tạo đơn ở POS, chọn theo IMEI. Thử thanh toán thất bại, rồi xác nhận thành công và mở hóa đơn.
4. Dùng mã hóa đơn hoặc IMEI mới bán để tiếp nhận bảo hành tại Hậu mãi.
5. Với điều chuyển, duyệt và xuất ở chi nhánh gửi, sau đó chuyển bộ chọn chi nhánh sang nơi nhận để xử lý.

Đề xuất giao diện gốc nằm trong [đoạn chat chia sẻ](https://chatgpt.com/share/6afc5740-1c58-83ec-9555-48c1db4f221c).

