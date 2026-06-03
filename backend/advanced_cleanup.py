import os
import hashlib
from pathlib import Path
from PIL import Image
from tqdm import tqdm

# Cấu hình đường dẫn
DATA_RAW = Path(r"d:\crop_project\crop_project\crop_project\data\raw")

def get_image_hash(fname):
    """Tính mã băm MD5 để phát hiện ảnh trùng lặp nội dung."""
    hasher = hashlib.md5()
    with open(fname, "rb") as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def advanced_cleanup():
    if not DATA_RAW.exists():
        print(f"[LOI] Khong tim thay thu muc: {DATA_RAW}")
        return

    hashes = {}
    deleted_small_size = 0
    deleted_small_dim = 0
    deleted_duplicate = 0
    total_scanned = 0
    
    print(f"=== BAT DAU DON DEP DU LIEU NANG CAO ===")
    print(f"Thu muc tieu tieu: {DATA_RAW}")
    
    # Lay danh sach tat ca anh
    all_images = list(DATA_RAW.rglob("*.*"))
    all_images = [f for f in all_images if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
    
    for img_path in tqdm(all_images, desc="Dang quet anh"):
        total_scanned += 1
        
        # 1. Kiem tra dung luong file (Xoa neu < 5KB - thuong la anh loi hoac thumbnail)
        if img_path.stat().st_size < 5120: 
            img_path.unlink()
            deleted_small_size += 1
            continue
            
        try:
            with Image.open(img_path) as img:
                # 2. Kiem tra kich thuoc anh (Xoa neu rong hoac cao < 100px)
                w, h = img.size
                if w < 100 or h < 100:
                    img_path.unlink()
                    deleted_small_dim += 1
                    continue
                
                # 3. Kiem tra trung lap bang Hashing
                h_code = get_image_hash(img_path)
                if h_code in hashes:
                    # Neu trung hash, xoa file hien tai
                    img_path.unlink()
                    deleted_duplicate += 1
                else:
                    hashes[h_code] = img_path
        except Exception:
            # Neu khong mo duoc anh (hong), xoa luon
            try:
                img_path.unlink()
                deleted_small_size += 1
            except: pass

    print(f"\n=== KET QUA DON DEP ===")
    print(f"- Tong so anh quet: {total_scanned}")
    print(f"- Xoa do dung luong thap (<5KB): {deleted_small_size}")
    print(f"- Xoa do kich thuoc qua nho (<100px): {deleted_small_dim}")
    print(f"- Xoa do trung lap noi dung: {deleted_duplicate}")
    print(f"- So anh 'sach' con lai: {len(hashes)}")
    print(f"========================")

if __name__ == "__main__":
    advanced_cleanup()
