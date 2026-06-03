<<<<<<< HEAD
import os
from pathlib import Path
from PIL import Image
from tqdm import tqdm

DIR = Path("data/processed")

def verify_and_clean():
    print(f"--- Bat dau kiem tra toan bo anh trong {DIR} ---")
    deleted_count = 0
    total_checked = 0
    
    # Duyet qua tat ca file
    all_files = list(DIR.rglob("*"))
    files_to_check = [f for f in all_files if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
    
    for img_path in tqdm(files_to_check, desc="Dang kiem tra"):
        total_checked += 1
        try:
            with Image.open(img_path) as img:
                img.verify()
        except Exception as e:
            print(f"\n[LOI] Anh bi loi: {img_path} - {e}")
            try:
                os.remove(img_path)
                deleted_count += 1
            except:
                print(f"Khong the xoa: {img_path}")

    print(f"\n--- KET THUC ---")
    print(f"Tong so anh da kiem tra: {total_checked}")
    print(f"So anh bi loi da xoa: {deleted_count}")

if __name__ == "__main__":
    verify_and_clean()
=======
import os
from pathlib import Path
from PIL import Image
from tqdm import tqdm

DIR = Path("data/processed")

def verify_and_clean():
    print(f"--- Bat dau kiem tra toan bo anh trong {DIR} ---")
    deleted_count = 0
    total_checked = 0
    
    # Duyet qua tat ca file
    all_files = list(DIR.rglob("*"))
    files_to_check = [f for f in all_files if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
    
    for img_path in tqdm(files_to_check, desc="Dang kiem tra"):
        total_checked += 1
        try:
            with Image.open(img_path) as img:
                img.verify()
        except Exception as e:
            print(f"\n[LOI] Anh bi loi: {img_path} - {e}")
            try:
                os.remove(img_path)
                deleted_count += 1
            except:
                print(f"Khong the xoa: {img_path}")

    print(f"\n--- KET THUC ---")
    print(f"Tong so anh da kiem tra: {total_checked}")
    print(f"So anh bi loi da xoa: {deleted_count}")

if __name__ == "__main__":
    verify_and_clean()
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
