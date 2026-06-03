import os
from pathlib import Path
from PIL import Image
from tqdm import tqdm

# Quet toan bo thu muc data (bao gom ca raw, train, val, test)
DATA_ROOT = Path(r"d:\crop_project\crop_project\crop_project\data")

def total_deep_clean():
    print(f"=== QUET SAU TOAN BO DU LIEU: {DATA_ROOT} ===")
    deleted_count = 0
    total_checked = 0
    
    all_images = list(DATA_ROOT.rglob("*.*"))
    all_images = [f for f in all_images if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
    
    for img_path in tqdm(all_images, desc="Dang lam sach triet de"):
        total_checked += 1
        try:
            with Image.open(img_path) as img:
                img.verify()
            with Image.open(img_path) as img:
                img.load()
                # Kiem tra them mot buoc nua la convert sang RGB
                _ = img.convert("RGB")
        except Exception:
            try:
                img_path.unlink()
                deleted_count += 1
            except: pass
            
    print(f"\n=== HOAN TAT LAM SACH === ")
    print(f"Tong so anh kiem tra: {total_checked}")
    print(f"So anh loi da xoa: {deleted_count}")

if __name__ == "__main__":
    total_deep_clean()
