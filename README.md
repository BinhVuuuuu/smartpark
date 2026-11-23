# SmartPark UET - Hệ Thống Xếp Lịch & Quản Lý Xe Máy Sinh Viên

> **Hệ thống phân quyền Đăng nhập (Admin / Sinh viên), Điều phối sức chứa bãi xe cố định và Đăng ký xếp lịch xe máy thông minh**  
> **Trường Đại học Công nghệ - Đại học Quốc gia Hà Nội (UET - VNU)**

---

## 1. Thông Tin Tài Khoản Đăng Nhập Hệ Thống

Hệ thống được thiết kế với **trang đăng nhập phân quyền bảo mật riêng biệt** giữa Quản trị viên và Sinh viên:

| Vai trò (Role) | Tên đăng nhập (Username) | Mật khẩu (Password) | Chức năng chính sau khi đăng nhập |
| :--- | :--- | :--- | :--- |
| **Quản Trị Viên (Admin)** | `admin` | `Admin@SmartPark2026!` | Truy cập **Trang Quản Trị Bãi Xe**: Điều phối 24 ca học, xem **Danh sách đầy đủ 350 sinh viên được duyệt**, thiết lập sức chứa, chạy thuật toán xếp lịch tự động toàn trường, giám sát cổng quét mã QR trực tiếp. |
| **Sinh Viên (User)** | `24020000` *(hoặc bất kỳ mã SV từ `24020000` đến `24024000`)* | `12345678` *(mặc định)* | Truy cập **Trang Đăng Ký Xếp Xe Cá Nhân**: Thẻ gửi xe số thông minh (QR Pass), thời khóa biểu, **chức năng đổi mật khẩu cá nhân**, form đăng ký số buổi & ca ưu tiên, nút báo nghỉ/nhượng chỗ cho bạn khác. |

> 🔒 **Cơ chế Bảo Mật & Đổi Mật Khẩu:**
> - Tài khoản sinh viên đăng nhập lần đầu với mật khẩu mặc định `12345678` sẽ được hệ thống tự động yêu cầu **đổi mật khẩu mới** (tối thiểu 6 ký tự) để kích hoạt và bảo vệ tài khoản.
> - Sinh viên có thể chủ động đổi mật khẩu bất kỳ lúc nào bằng nút **"🔑 Đổi mật khẩu"** ở góc trên bên phải màn hình.
> - Mật khẩu sinh viên được mã hóa an toàn bằng thuật toán chuẩn công nghiệp **PBKDF2** kèm chuỗi muối (Salt) ngẫu nhiên và lưu trữ trực tiếp trong **Cơ sở dữ liệu SQLite** (`app/data/smartpark.db`).

> 🔒 **Bảo mật giao diện đăng nhập:**
> - Màn hình đăng nhập không hiển thị mật khẩu Admin và không sử dụng nút đăng nhập nhanh nhằm đảm bảo tính bảo mật và riêng tư của hệ thống quản trị.

3. **Quy Trình Phê Duyệt Đăng Ký Chặt Chẽ (Admin Approval Workflow)**:
   - Khi sinh viên đăng ký hoặc cập nhật nguyện vọng (số buổi, khoảng cách, ca học ưu tiên), hồ sơ sẽ ở trạng thái **Chờ duyệt (Pending)** và **chưa được thêm vào lịch**.
   - **Quản trị viên (Admin)** có khu vực riêng để xem xét danh sách đơn đăng ký chờ duyệt:
     - Nút **[✓ Phê duyệt]**: Phê duyệt từng sinh viên, giải thuật ILP lập tức chạy lại để tự động xếp ca vào lịch.
     - Nút **[✕ Từ chối]**: Từ chối các hồ sơ không hợp lệ hoặc khi ca học quá tải.
     - Nút **[⚡ Phê Duyệt Tất Cả Đơn Chờ Duyệt]**: Duyệt hàng loạt chỉ với 1 cú nhấp chuột.
   - Khi được Admin duyệt: Cổng sinh viên sẽ chuyển trạng thái sang **Hợp Lệ (Approved)**, kích hoạt mã QR hợp lệ và hiển thị các ca được đi xe máy.

---

## 2. Giao Diện & Chức Năng Từng Trang

### A. Trang Quản Trị Viên (Admin Dashboard)
Sau khi đăng nhập tài khoản `admin`:
1. **Bảng Thống kê & KPI Vận Hành**:
   - Tổng số sinh viên có nhu cầu ($350$ SV).
   - Tỷ lệ sinh viên được phục vụ ($100\%$).
   - Sức chứa bãi xe ($50$ xe/ca, tổng $600$ lượt/tuần).
   - Chỉ số công bằng phân bổ Jain's Index ($> 90\%$).
2. **Bảng Điều Phối Lịch 24 Ca Trong Tuần (Weekly Dispatch Matrix)**:
   - Ma trận nhiệt 24 ca (Thứ 2 đến Thứ 7, mỗi ngày 4 ca: Ca 1 [07:00-09:35], Ca 2 [10:00-12:35], Ca 3 [13:20-15:55], Ca 4 [16:20-18:55]).
   - Tỷ lệ lấp đầy từng ca $\le 50$ xe/ca (đảm bảo **0 ca vượt quá sức chứa**).
   - Bấm vào bất kỳ ca nào để xem danh sách chi tiết: Mã SV, Họ tên, Biển số xe, Khoảng cách.
3. **Bộ Điều Hành & Xếp Lịch Tự Động**:
   - Tùy chỉnh sức chứa $C$ (từ $30 \to 200$ xe/ca) và số buổi tối đa $K_{\max}$ ($1 - 2$ buổi/tuần).
   - Nút **"⚡ Chạy Xếp Lịch Tự Động"**: Tối ưu hóa phân bổ theo Quy hoạch nguyên ILP đảm bảo $100\%$ không quá tải và công bằng tuyệt đối.
   - Nút **"📊 Đối Sánh Hiệu Quả Giải Thuật"**: So sánh với thuật toán tham lam (Greedy) và ngẫu nhiên (Random).
   - Nút **"🔄 Tạo Lại Danh Sách 350 SV"**: Làm mới dữ liệu ngẫu nhiên.
4. **Giám Sát Cổng Vào Trực Tiếp (Live Gate Monitor)**:
   - Khung hình hoạt họa mô phỏng dòng xe qua 2 làn cổng quét mã QR tự động.
   - Thống kê thời gian quét thực tế (~2.4 giây/xe), loại bỏ hoàn toàn ùn tắc giờ cao điểm.

---

### B. Trang Sinh Viên (Student Portal & Registration)
Sau khi đăng nhập tài khoản sinh viên (ví dụ `24020000`):
1. **Thẻ Gửi Xe Máy Điện Tử (Digital Parking Pass)**:
   - Thẻ số hóa với **mã QR động**, biển số xe máy, ngành học, nơi ở trọ.
   - Hiển thị hạn mức được cấp (ví dụ: *2 buổi / tuần*).
2. **Thời Khóa Biểu & Lịch Được Đi Xe Trong Tuần**:
   - Hiển thị 12 ca học, các ca có giờ học tại trường.
   - Các ca được cấp phép đi xe máy được tô viền xanh lá đậm.
   - Nút **"🌟 Báo nghỉ / Nhượng chỗ"**: Cho phép sinh viên giải phóng chỗ khi bận học online hoặc đi xe bus để nhường slot cho các bạn khác có nhu cầu.
3. **Form Đăng Ký Xếp Lịch Xe Máy Cá Nhân**:
   - Khai báo số buổi mong muốn đi xe máy ($1$ hoặc $2$ buổi/tuần).
   - Nhập biển số xe máy (ví dụ `29-B1-48291`).
   - Chọn nơi ở/trọ và khoảng cách tới trường (km).
   - Tích chọn các ca học muốn ưu tiên đi xe máy nhất.
   - Nút **"💾 Cập Nhật & Đăng Ký Xếp Chỗ Ngay"**: Hồ sơ được chuyển đến Ban Quản trị phê duyệt trước khi thêm vào lịch.

---

## 3. Hướng Dẫn Khởi Chạy Ứng Dụng

1. Vào thư mục `c:\Khoa học dịch vụ`.
2. Nhấp đúp vào file [**`start.bat`**](file:///c:/Khoa%20h%E1%BB%8Dc%20d%E1%BB%8Bch%20v%E1%BB%A5/start.bat).
3. Trình duyệt sẽ tự động mở trang web tại địa chỉ:
   👉 **`http://localhost:3000`**

---

## 4. Kiến Trúc Cơ Sở Dữ Liệu SQLite (Database Architecture)

Hệ thống được tích hợp **Cơ sở dữ liệu SQLite 3 chuẩn hóa** sử dụng module gốc `node:sqlite` (`DatabaseSync`) tích hợp sẵn trong Node.js (Zero-dependency, không cần cài thêm thư viện phụ thuộc):

- **Tệp CSDL:** [`app/data/smartpark.db`](file:///c:/Khoa%20h%E1%BB%8Dc%20d%E1%BB%8Bch%20v%E1%BB%A5/app/data/smartpark.db)
- **Các bảng dữ liệu chính:**
  1. `accounts`: Lưu trữ tài khoản người dùng, vai trò (`admin`, `student`), chuỗi Salt và Hash mật khẩu mã hóa PBKDF2, cờ đăng nhập lần đầu (`is_first_login`).
  2. `students`: Lưu trữ toàn bộ hồ sơ sinh viên (`24020000` - `24024000`), thời khóa biểu thực tế (`class_sessions`), thứ tự nguyện vọng ca học (`session_preferences`), khoảng cách, nơi ở và biển số xe.
  3. `allocations`: Lưu trữ toàn bộ kết quả phân bổ slot gửi xe thực tế cho từng ca học sau khi giải thuật tối ưu hóa ILP hoàn tất.
  4. `system_config`: Lưu trữ các thông số vận hành của bãi xe (sức chứa $C$, hạn mức $K_{\max}$, hệ số trọng số phân bổ, thông số hàng đợi Markov $M/M/s$).
  5. `co_creation_logs`: Lưu nhật ký hành vi nhượng chỗ/báo vắng của sinh viên để điều phối slot công bằng.
- **Tính bền vững (Persistence):** Mọi thao tác đổi mật khẩu, đăng ký xe, nhượng chỗ, điều chỉnh cấu hình và xếp lịch đều được lưu trữ trực tiếp vào CSDL SQLite và duy trì nguyên vẹn kể cả khi khởi động lại máy chủ hoặc máy tính.
"# smartpark" 
