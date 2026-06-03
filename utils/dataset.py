"""
utils/dataset.py
================
Chuẩn bị, chia và tải dataset.

Cách dùng:
    from utils.dataset import prepare_dataset, create_generators
    prepare_dataset()          # Chia raw → train/val/test
    train_gen, val_gen, test_gen = create_generators()
"""

import os
import shutil
import random
from pathlib import Path

import numpy as np
from tqdm import tqdm
from tensorflow.keras.preprocessing.image import ImageDataGenerator

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    RAW_DIR, TRAIN_DIR, VAL_DIR, TEST_DIR,
    CLASSES, TRAIN_RATIO, VAL_RATIO, RANDOM_SEED,
    IMG_SIZE, BATCH_SIZE,
)

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".JPG", ".JPEG", ".PNG"}


# ── Tạo thư mục ───────────────────────────────────────────
def _make_dirs():
    for split in [TRAIN_DIR, VAL_DIR, TEST_DIR]:
        for cls in CLASSES:
            (split / cls).mkdir(parents=True, exist_ok=True)


# -- Dataset stats ------------------------------------------
def dataset_stats(verbose=True):
    """Returns a dict of image counts per class and split."""
    stats = {}
    for split_name, split_dir in [("train", TRAIN_DIR), ("val", VAL_DIR), ("test", TEST_DIR)]:
        stats[split_name] = {}
        for cls in CLASSES:
            path = split_dir / cls
            count = len([f for f in path.glob("*") if f.suffix in SUPPORTED_EXTS]) if path.exists() else 0
            stats[split_name][cls] = count

    if verbose:
        from config import CLASS_INFO
        print(f"\n{'Class':<18} {'Train':>6} {'Val':>6} {'Test':>6} {'Total':>6}")
        print("-" * 48)
        for cls in CLASSES:
            en_name = CLASS_INFO[cls]["en"]
            tr = stats["train"].get(cls, 0)
            va = stats["val"].get(cls, 0)
            te = stats["test"].get(cls, 0)
            print(f"{en_name:<18} {tr:>6} {va:>6} {te:>6} {tr+va+te:>6}")
        total = sum(sum(v.values()) for v in stats.values())
        print(f"\n  Total: {total:,} images")
    return stats


# ── Chia dataset ──────────────────────────────────────────
def prepare_dataset(raw_dir=None, seed=RANDOM_SEED, overwrite=False):
    """
    Chia ảnh từ raw_dir thành train/val/test.

    Cấu trúc raw_dir cần có:
        data/raw/
        ├── rice/
        ├── corn/
        └── ...
    """
    src_dir = Path(raw_dir) if raw_dir else RAW_DIR
    random.seed(seed)
    
    if overwrite:
        print("Cleaning old data...")
        for d in [TRAIN_DIR, VAL_DIR, TEST_DIR]:
            if d.exists():
                shutil.rmtree(d)
                
    _make_dirs()

    print("Splitting dataset with Smart-Balance strategy...")
    from config import SYNTHETIC_DIR

    for cls in CLASSES:
        # Chuẩn hóa tên class để so khớp
        cls_norm = cls.lower().replace("_", " ")
        
        # ── 1. Tìm ảnh từ RAW ──
        relevant_raw_dirs = []
        for d in src_dir.iterdir():
            if not d.is_dir(): continue
            d_name_norm = d.name.lower().replace("___", " ").replace("_", " ")
            if d_name_norm == cls_norm or (cls_norm in d_name_norm and "___" in d.name) or d.name.lower() == cls.lower():
                relevant_raw_dirs.append(d)

        # Fallback search
        if not relevant_raw_dirs:
            relevant_raw_dirs = [d for d in src_dir.iterdir() if d.is_dir() and cls_norm in d.name.lower()]
        
        raw_imgs = []
        for d in relevant_raw_dirs:
            raw_imgs.extend([f for f in d.iterdir() if f.suffix in SUPPORTED_EXTS])

        # ── 2. Tìm ảnh từ SYNTHETIC ──
        syn_imgs = []
        syn_cls_dir = SYNTHETIC_DIR / cls
        if syn_cls_dir.exists():
            syn_imgs = [f for f in syn_cls_dir.iterdir() if f.suffix in SUPPORTED_EXTS]

        imgs = raw_imgs + syn_imgs
            
        if not imgs:
            print(f"  Warning: {cls}: no suitable images found")
            continue

        # ── 3. Phân loại & Phân chia không rò rỉ dữ liệu (No Data Leakage Split) ──
        product_keywords = ["product", "tuber", "_dl_", "reference", "synthetic"]
        product_imgs = [f for f in imgs if any(kw in f.name.lower() for kw in product_keywords)]
        other_imgs = [f for f in imgs if f not in product_imgs]
        
        random.shuffle(product_imgs)
        random.shuffle(other_imgs)
        
        # Chia tỉ lệ Train (70%), Val (15%), Test (15%) một cách sạch sẽ cho từng nhóm ảnh
        def split_list(lst):
            length = len(lst)
            n_tr = int(length * TRAIN_RATIO)
            n_va = int(length * VAL_RATIO)
            return lst[:n_tr], lst[n_tr:n_tr + n_va], lst[n_tr + n_va:]

        prod_train, prod_val, prod_test = split_list(product_imgs)
        oth_train, oth_val, oth_test = split_list(other_imgs)
        
        train_raw = prod_train + oth_train
        val_raw = prod_val + oth_val
        test_raw = prod_test + oth_test
        
        # ── 4. Cân bằng thông minh (Smart-Balance) chỉ trên tập TRAIN ──
        TARGET_TRAIN = 700
        TARGET_VAL = 150
        TARGET_TEST = 150
        
        # Xử lý tập Train (Oversampling hoặc Undersampling)
        if len(train_raw) > TARGET_TRAIN:
            # Ưu tiên giữ lại ảnh product/tuber
            rem = TARGET_TRAIN - len(prod_train)
            oth_tr_final = oth_train[:max(rem, 0)]
            train_final = prod_train + oth_tr_final
        elif len(train_raw) > 0:
            # Nhân bản (Oversampling) chỉ trên tập Train để bù đắp lớp ít ảnh
            multiplier = (TARGET_TRAIN // len(train_raw)) + 1
            train_final = (train_raw * multiplier)[:TARGET_TRAIN]
        else:
            train_final = []

        # Tập Val & Test giữ nguyên ảnh gốc sạch (chỉ giới hạn tối đa để tránh mất cân bằng nếu quá nhiều)
        val_final = val_raw[:TARGET_VAL]
        test_final = test_raw[:TARGET_TEST]
        
        random.shuffle(train_final)
        print(f"  Class {cls}: {len(product_imgs)} products + {len(other_imgs)} others -> Train: {len(train_final)} (Oversampled) | Val: {len(val_final)} | Test: {len(test_final)}")

        splits = {
            TRAIN_DIR: train_final,
            VAL_DIR:   val_final,
            TEST_DIR:  test_final,
        }
        for dest, files in splits.items():
            for i, f in enumerate(tqdm(files, desc=f"  {cls}/{dest.name}", leave=False)):
                # Đổi tên file để tránh trùng tên khi ghi đè tập train oversampled
                dst = dest / cls / f"{i}_{f.name}" 
                if not dst.exists() or overwrite:
                    shutil.copy2(f, dst)

    print("Dataset splitting complete!")
    dataset_stats()
    return True


# ── Data generators ───────────────────────────────────────
def create_generators(backbone_name="mobilenetv2", augment=True):
    """
    Tạo ImageDataGenerator cho train / val / test.

    Args:
        backbone_name: tên backbone để lấy hàm preprocess_input và size
        augment: có dùng augmentation hay không

    Returns:
        train_gen, val_gen, test_gen
    """
    from utils.model import BACKBONES
    from utils.predict_utils import get_custom_prep_fn
    
    bname = backbone_name.lower()
    if bname not in BACKBONES:
        bname = "mobilenetv2" # Default phòng hờ
        
    info = BACKBONES[bname]
    h, w = info["size"]
    base_prep_fn = info.get("prep")

    # Sử dụng pipeline tiền xử lý chung có chứa CLAHE/Denoise
    prep_fn = get_custom_prep_fn(base_prep_fn)

    # Lưu ý: Nếu có prep_fn, ta KHÔNG dùng rescale=1/255 vì prep_fn sẽ tự lo.
    
    if augment:
        train_datagen = ImageDataGenerator(
            preprocessing_function=prep_fn,
            rotation_range=50,          # Tăng từ 40 -> 50 cho các góc chụp nghiêng ngoài đồng
            width_shift_range=0.3,      # Tăng từ 0.2 -> 0.3
            height_shift_range=0.3,
            shear_range=0.2,            # Tăng từ 0.15 -> 0.2
            zoom_range=0.35,            # Tăng từ 0.25 -> 0.35 cho các ảnh chụp xa
            horizontal_flip=True,
            vertical_flip=True,
            brightness_range=[0.5, 1.5], # Dải sáng rộng hơn cho nắng gắt/bóng râm
            channel_shift_range=30.0,    # Tăng độ lệch kênh màu cho các bộ cảm biến khác nhau
            fill_mode="nearest",
            # Giả lập camera bị mờ sương nhẹ
        )
    else:
        train_datagen = ImageDataGenerator(preprocessing_function=prep_fn)

    val_test_datagen = ImageDataGenerator(preprocessing_function=prep_fn)

    common = dict(
        target_size=(h, w),
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        classes=CLASSES,
    )

    train_gen = train_datagen.flow_from_directory(
        TRAIN_DIR, shuffle=True, **common
    )
    val_gen = val_test_datagen.flow_from_directory(
        VAL_DIR, shuffle=False, **common
    )
    test_gen = val_test_datagen.flow_from_directory(
        TEST_DIR, shuffle=False, **common
    )

    return train_gen, val_gen, test_gen


# ── Class weights ─────────────────────────────────────────
def get_class_weights(train_gen):
    """Tính class weights để xử lý mất cân bằng dữ liệu."""
    from sklearn.utils.class_weight import compute_class_weight
    unique_classes = np.unique(train_gen.classes)
    weights = compute_class_weight(
        class_weight="balanced",
        classes=unique_classes,
        y=train_gen.classes,
    )
    # Ánh xạ đúng trọng số tới chỉ mục lớp thực tế
    weight_dict = {cls_idx: weight for cls_idx, weight in zip(unique_classes, weights)}
    # Bổ sung trọng số mặc định 1.0 cho các lớp không có ảnh để tránh lỗi chỉ mục khi huấn luyện
    num_classes = len(train_gen.class_indices)
    for i in range(num_classes):
        if i not in weight_dict:
            weight_dict[i] = 1.0
    return weight_dict


# ── Download từ Kaggle ────────────────────────────────────
def download_kaggle(dataset=None):
    """Tải dataset từ Kaggle API."""
    from config import KAGGLE_DATASET
    ds = dataset or KAGGLE_DATASET
    try:
        import kaggle
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        print(f"📥 Đang tải: {ds}")
        kaggle.api.dataset_download_files(ds, path=str(RAW_DIR), unzip=True)
        print("✅ Tải xong!")
        return True
    except ImportError:
        print("❌ Chưa cài kaggle: pip install kaggle")
    except Exception as e:
        print(f"❌ Lỗi Kaggle: {e}")
        _print_manual_guide()
    return False


def _print_manual_guide():
    print("\n📖 Tải thủ công:")
    print("  1. Vào: https://www.kaggle.com/datasets/mdwaquarazam/agricultural-crops-image-collection")
    print("  2. Download → Giải nén vào: data/raw/")
    print("  3. Đổi tên thư mục thành: rice, corn, sweet_potato, ...")
