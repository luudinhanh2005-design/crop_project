import os
from pathlib import Path
from PIL import Image
from tqdm import tqdm
import sys

# Thêm đường dẫn để tìm config
sys.path.append(str(Path(__file__).parent.parent))
from backend.config import TRAIN_DIR, VAL_DIR, TEST_DIR

def clean_split(split_dir):
    print(f"\nSàng lọc dữ liệu tại: {split_dir.name}")
    count = 0
    removed = 0
    
    # Duyệt qua tất cả các file ảnh
    image_files = list(split_dir.glob("**/*.*"))
    for img_path in tqdm(image_files, desc=f"Checking {split_dir.name}"):
        if img_path.suffix.lower() not in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']:
            continue
            
        try:
            # Thử mở ảnh bằng PIL
            with Image.open(img_path) as img:
                img.verify() # Kiểm tra file có bị hỏng không
            count += 1
        except Exception:
            # Nếu lỗi, xóa file ngay lập tức
            os.remove(img_path)
            removed += 1
            
    print(f"   -> Hoàn tất: Giữ lại {count} ảnh, đã xóa {removed} ảnh lỗi.")

if __name__ == "__main__":
    print("=== BẮT ĐẦU SÀNG LỌC DỮ LIỆU LỖI ===")
    for d in [TRAIN_DIR, VAL_DIR, TEST_DIR]:
        if d.exists():
            clean_split(d)
    print("\n=== DỮ LIỆU ĐÃ SẠCH SẼ! BẠN CÓ THỂ BẮT ĐẦU TRAIN LẠI ===")
