import os
import shutil
import random
from pathlib import Path
from tqdm import tqdm

# Cấu hình đường dẫn
ROOT_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT_DIR / "crop_dataset_raw"
DEST_DIR = ROOT_DIR / "data_specialist"

TARGET_CLASSES = [
    "soybean_product",
    "sugarcane_product",
    "sweet_potato_product",
    "wheat_product",
    "wheat_stalk"
]

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".JPG", ".JPEG", ".PNG"}

def prepare_data():
    random.seed(42)
    print("--- Bắt đầu dọn dẹp và chuẩn bị dữ liệu Chuyên gia (15 lớp) ---")
    
    # Xóa thư mục cũ nếu có
    if DEST_DIR.exists():
        print(f"Xóa dữ liệu cũ tại {DEST_DIR}...")
        shutil.rmtree(DEST_DIR)
        
    # Tạo cấu trúc thư mục
    for split in ["train", "val", "test"]:
        for cls in TARGET_CLASSES:
            (DEST_DIR / split / cls).mkdir(parents=True, exist_ok=True)
            
    print("Đang sao chép và phân chia dữ liệu...")
    
    for cls in TARGET_CLASSES:
        cls_dir = RAW_DIR / cls
        if not cls_dir.exists():
            print(f"⚠️ Cảnh báo: Không tìm thấy thư mục {cls_dir}")
            continue
            
        # Lấy danh sách ảnh hợp lệ
        imgs = [f for f in cls_dir.iterdir() if f.suffix in SUPPORTED_EXTS]
        if not imgs:
            print(f"⚠️ Cảnh báo: Thư mục {cls} không chứa ảnh hợp lệ.")
            continue
            
        random.shuffle(imgs)
        
        # Chia tỷ lệ 70% Train, 15% Val, 15% Test
        n = len(imgs)
        n_train = int(n * 0.70)
        n_val = int(n * 0.15)
        
        train_raw = imgs[:n_train]
        val_raw = imgs[n_train:n_train + n_val]
        test_raw = imgs[n_train + n_val:]
        
        # Oversampling tập Train lên 1000 ảnh để học tốt nhất
        TARGET_TRAIN = 1000
        if len(train_raw) > 0:
            multiplier = (TARGET_TRAIN // len(train_raw)) + 1
            train_final = (train_raw * multiplier)[:TARGET_TRAIN]
        else:
            train_final = []
            
        # Giới hạn tối đa 150 ảnh cho Val & Test gốc sạch
        val_final = val_raw[:150]
        test_final = test_raw[:150]
        
        print(f"  Lớp {cls:<22} -> Train: {len(train_final)} (Oversampled) | Val: {len(val_final)} | Test: {len(test_final)}")
        
        # Sao chép file
        splits = {
            "train": train_final,
            "val": val_final,
            "test": test_final
        }
        
        for split_name, files in splits.items():
            split_dir = DEST_DIR / split_name / cls
            for i, f in enumerate(files):
                dst = split_dir / f"{i}_{f.name}"
                shutil.copy2(f, dst)
                
    print("\n✅ Hoàn tất chuẩn bị dữ liệu chuyên gia!")

if __name__ == "__main__":
    prepare_data()
