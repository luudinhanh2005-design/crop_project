<<<<<<< HEAD
import os
from pathlib import Path
from PIL import Image, ImageFile
from tqdm import tqdm

DIRS = [Path("crop_dataset_raw"), Path("data/train"), Path("data/val"), Path("data/test")]
# Cho phép mở file bị cắt bớt nhưng báo lõi khi load để phát hiện
ImageFile.LOAD_TRUNCATED_IMAGES = False 

def verify_and_clean_thoroughly():
    deleted_count = 0
    total_checked = 0
    
    for d in DIRS:
        if not d.exists():
            continue
        print(f"\n--- Kiem tra sau (Deep Check) thu muc: {d} ---")
        all_files = list(d.rglob("*"))
        files_to_check = [f for f in all_files if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
        
        for img_path in tqdm(files_to_check, desc=f"Kiem tra {d.name}"):
            total_checked += 1
            try:
                # Mở và load nội dung ảnh thực sự vào RAM để bắt lỗi truncated
                with Image.open(img_path) as img:
                    img.load() 
            except Exception as e:
                print(f"\n[LOI] Anh hong/truncated: {img_path} - {e}")
                try:
                    os.remove(img_path)
                    deleted_count += 1
                except:
                    print(f"Khong the xoa: {img_path}")

    print(f"\n--- KET THUC ---")
    print(f"Tong so anh da xu ly: {total_checked}")
    print(f"So anh bi loi da xoa: {deleted_count}")

if __name__ == "__main__":
    verify_and_clean_thoroughly()
=======
import os
from pathlib import Path
from PIL import Image, ImageFile
from tqdm import tqdm

DIRS = [Path("crop_dataset_raw"), Path("data/train"), Path("data/val"), Path("data/test")]
# Cho phép mở file bị cắt bớt nhưng báo lõi khi load để phát hiện
ImageFile.LOAD_TRUNCATED_IMAGES = False 

def verify_and_clean_thoroughly():
    deleted_count = 0
    total_checked = 0
    
    for d in DIRS:
        if not d.exists():
            continue
        print(f"\n--- Kiem tra sau (Deep Check) thu muc: {d} ---")
        all_files = list(d.rglob("*"))
        files_to_check = [f for f in all_files if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
        
        for img_path in tqdm(files_to_check, desc=f"Kiem tra {d.name}"):
            total_checked += 1
            try:
                # Mở và load nội dung ảnh thực sự vào RAM để bắt lỗi truncated
                with Image.open(img_path) as img:
                    img.load() 
            except Exception as e:
                print(f"\n[LOI] Anh hong/truncated: {img_path} - {e}")
                try:
                    os.remove(img_path)
                    deleted_count += 1
                except:
                    print(f"Khong the xoa: {img_path}")

    print(f"\n--- KET THUC ---")
    print(f"Tong so anh da xu ly: {total_checked}")
    print(f"So anh bi loi da xoa: {deleted_count}")

if __name__ == "__main__":
    verify_and_clean_thoroughly()
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
