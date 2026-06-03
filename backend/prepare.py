import sys
from pathlib import Path

# Thêm thư mục gốc vào đường dẫn để Python tìm thấy 'utils'
sys.path.append(str(Path(__file__).parent.parent))

from utils.dataset import prepare_dataset

if __name__ == "__main__":
    print("--- Đang bắt đầu phân chia dữ liệu (có thể mất vài phút) ---")
    prepare_dataset(overwrite=True)
    print("--- Hoàn tất! ---")
