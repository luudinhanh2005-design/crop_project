import os
import shutil
from pathlib import Path

# Thư mục gốc chứa dữ liệu
RAW_DIR = Path(r"d:\crop_project\crop_project\crop_project\data\raw")
MIN_SIZE_KB = 20 # Xóa các ảnh dưới 20KB (thumbnail/icon)

def clean_garbage():
    print(f"=== BAT DAU DON DEP DU LIEU RAC (Min: {MIN_SIZE_KB}KB) ===")
    
    deleted_count = 0
    total_count = 0
    
    # Duyệt qua tất cả các thư mục con trong data/raw
    for folder in RAW_DIR.iterdir():
        if not folder.is_dir():
            continue
            
        print(f"Dang quet: {folder.name}...")
        for img_path in folder.glob("*.*"):
            total_count += 1
            # Kiểm tra dung lượng
            size_kb = img_path.stat().st_size / 1024
            if size_kb < MIN_SIZE_KB:
                try:
                    img_path.unlink()
                    deleted_count += 1
                except:
                    pass
    
    print("\n=== HOAN TAT ===")
    print(f"Tong so anh da quet: {total_count}")
    print(f"So anh rac da xoa:   {deleted_count}")
    print(f"Con lai:             {total_count - deleted_count} anh quí gia.")

if __name__ == "__main__":
    clean_garbage()
