---
title: AgriSocial
emoji: 🌱
colorFrom: green
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# AgriSocial - Hệ thống Nhận diện Cây trồng AI

Dự án AgriSocial là một mạng xã hội nông nghiệp thông minh tích hợp trí tuệ nhân tạo để nhận diện sâu bệnh và cây trồng, kết nối cộng đồng nông dân và chuyên gia.

## 🚀 Hướng dẫn cài đặt nhanh

### 1. Chuẩn bị môi trường
Yêu cầu: Python 3.8 trở lên.

```bash
# Tạo môi trường ảo
python3 -m venv venv

# Kích hoạt môi trường ảo (Linux/macOS)
source venv/bin/activate

# Cài đặt thư viện
pip install -r requirements.txt
```

### 2. Cấu hình Supabase
Mở file `frontend/index.html` và `backend/config.py` để kiểm tra thông tin `SUPABASE_URL` và `SUPABASE_KEY`. (Hiện tại đã được cấu hình sẵn cho demo).

### 3. Chạy dự án
Sử dụng file script đã chuẩn bị sẵn (Dành cho Linux):

```bash
chmod +x start_project.sh
./start_project.sh
```

Hoặc chạy thủ công:

```bash
# Chạy Backend
cd backend
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

Sau đó truy cập địa chỉ: `http://localhost:8000`

## 📁 Cấu trúc dự án
- `backend/`: Chứa mã nguồn API (FastAPI) và xử lý AI.
- `frontend/`: Giao diện người dùng (HTML, CSS, JS).
- `models/`: Chứa các file mô hình AI (.h5).
- `utils/`: Các hàm bổ trợ xử lý hình ảnh và dữ liệu.

## ⚠️ Lưu ý cho đồng nghiệp
- Thư mục `history/` đã được đưa vào `.gitignore` để tránh đẩy dữ liệu cá nhân lên GitHub.
- Dự án sử dụng **Supabase** để quản lý dữ liệu và xác thực (Google/Facebook Login). Hãy đảm bảo máy của bạn có kết nối internet để đăng nhập.
- Nếu gặp lỗi `bad_oauth_state` khi đăng nhập, hãy kiểm tra Redirect URLs trong Supabase Dashboard và đảm bảo đúng cổng (8000).

---
© 2026 AgriSocial Team.
