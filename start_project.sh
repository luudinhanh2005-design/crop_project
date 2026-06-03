#!/bin/bash
echo "=============================================="
echo "   CROP RECOGNITION AI - LAUNCH PROJECT       "
echo "=============================================="

echo "Đang khởi động Hệ thống AI và Giao diện Web (Linux Mode)..."

# Kiểm tra venv
if [ ! -d "venv" ]; then
    echo "Lỗi: Không tìm thấy thư mục venv. Hãy chạy lệnh cài đặt môi trường trước."
    exit 1
fi

# Tự động giết process cũ nếu đang chiếm port 8000
echo "Đang dọn dẹp port 8000..."
fuser -k 8000/tcp 2>/dev/null
sleep 2

# Chạy uvicorn trong background
cd backend && ../venv/bin/python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload &

echo ""
echo "Hoàn tất! Đang chờ server khởi động..."
sleep 5

echo "Đang mở trình duyệt..."
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:8000
elif command -v open > /dev/null; then
    open http://localhost:8000
else
    echo "Vui lòng truy cập: http://localhost:8000"
fi
