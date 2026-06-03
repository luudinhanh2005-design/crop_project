FROM python:3.10-slim

# Ngăn Python ghi file .pyc và bật log không đệm
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết cho OpenCV, Matplotlib, v.v.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy và cài đặt các thư viện Python trước để tối ưu hóa bộ nhớ đệm của Docker
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy toàn bộ mã nguồn của dự án (bao gồm cả backend và thư mục frontend/www)
COPY . /app/

# Expose cổng kết nối (Mặc định của Hugging Face Spaces là 7860)
EXPOSE 7860

# Đặt thư mục làm việc là backend để chạy FastAPI đúng context đường dẫn
WORKDIR /app/backend

# Khởi chạy server uvicorn
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT}"]
