<<<<<<< HEAD
"""
utils/predict_utils.py
======================
Tiện ích dự đoán ảnh đơn lẻ và hàng loạt.
"""

import numpy as np
import cv2
from pathlib import Path
from PIL import Image
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CLASSES, CLASS_INFO, IMG_SIZE, USE_CLAHE, USE_DENOISE
from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

def apply_advanced_filters_array(arr: np.ndarray) -> np.ndarray:
    """
    Áp dụng CLAHE và Noise Reduction cho Numpy Array (H, W, 3) RGB.
    Giúp tăng cường chi tiết cho ảnh chụp qua màn hình/nhòe.
    """
    # Xử lý datatype an toàn
    if arr.dtype != np.uint8:
        out_dtype = arr.dtype
        img_uint8 = np.clip(arr, 0, 255).astype(np.uint8)
    else:
        out_dtype = np.uint8
        img_uint8 = arr.copy()
        
    img_bgr = cv2.cvtColor(img_uint8, cv2.COLOR_RGB2BGR)
    
    # 1. Median Blur khử nhiễu
    if USE_DENOISE:
        img_bgr = cv2.medianBlur(img_bgr, 3)
        
    # 2. CLAHE cân bằng sáng
    if USE_CLAHE:
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        img_bgr = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return img_rgb.astype(out_dtype)


def get_custom_prep_fn(base_prep_fn):
    """
    Tạo hàm preprocessing dùng chung cho cả Generator (lúc train) và Inference (lúc test).
    """
    def custom_prep(x):
        # 1. Áp dụng filter (CLAHE/Denoise)
        x_filtered = apply_advanced_filters_array(x)
        # 2. Áp dụng model prep fn
        if base_prep_fn is not None:
             x_filtered = base_prep_fn(x_filtered)
        else:
             x_filtered = x_filtered / 255.0
        return x_filtered
    return custom_prep



def preprocess_image(source, img_size=None, backbone_name="efficientnetb3") -> np.ndarray:
    """
    Tiền xử lý ảnh từ file path hoặc PIL Image.

    Returns:
        np.ndarray shape (1, H, W, 3), dtype float32, đã qua prep_fn
    """
    size = img_size or IMG_SIZE
    if isinstance(source, (str, Path)):
        img = Image.open(source).convert("RGB")
    elif hasattr(source, 'read'): # File uploader handle
        img = Image.open(source).convert("RGB")
    elif isinstance(source, Image.Image):
        img = source.convert("RGB")
    else:
        img = source  # numpy array case handled below

    img = img.resize((size[1], size[0]), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)
    
    from utils.model import BACKBONES
    bname = backbone_name.lower()
    base_prep_fn = BACKBONES[bname].get("prep") if bname in BACKBONES else None
    
    # Sử dụng pipeline preprocessing chung
    prep_fn = get_custom_prep_fn(base_prep_fn)
    arr = prep_fn(arr)
        
    return np.expand_dims(arr, axis=0)


def predict_single(source, model) -> dict:
    """
    Dự đoán 1 ảnh.

    Returns:
        {
          "class": "rice",
          "name_vi": "Lúa",
          "confidence": 0.97,
          "top3": [{"rank":1, "class":"rice", "name_vi":"Lúa", "prob":0.97}, ...]
          "all": {"rice": 0.97, "corn": 0.01, ...}
        }
    """
    # Lấy backbone_name từ model
    bname = "efficientnetb3"
    if model.name.startswith("CropClassifier_"):
        bname = model.name.split("_", 1)[1]
        
    # Lấy input shape từ model
    _, h, w, _ = model.input_shape
    arr  = preprocess_image(source, img_size=(h, w), backbone_name=bname)
    prob = model.predict(arr, verbose=0)[0]

    top3_idx = np.argsort(prob)[::-1][:3]
    return {
        "class":      CLASSES[top3_idx[0]],
        "name_vi":    CLASS_INFO[CLASSES[top3_idx[0]]]["vi"],
        "confidence": float(prob[top3_idx[0]]),
        "top3": [
            {
                "rank":    i + 1,
                "class":   CLASSES[idx],
                "name_vi": CLASS_INFO[CLASSES[idx]]["vi"],
                "emoji":   CLASS_INFO[CLASSES[idx]]["emoji"],
                "prob":    float(prob[idx]),
            }
            for i, idx in enumerate(top3_idx)
        ],
        "all": {CLASSES[i]: float(prob[i]) for i in range(len(CLASSES))},
    }


def predict_batch(folder, model, verbose=True) -> list:
    """
    Dự đoán tất cả ảnh trong một thư mục.

    Returns:
        list of result dicts
    """
    folder = Path(folder)
    images = [f for f in folder.rglob("*") if f.suffix.lower() in SUPPORTED_EXTS]

    if not images:
        print(f"⚠️  Không tìm thấy ảnh trong: {folder}")
        return []

    results = []
    correct = 0
    total   = len(images)

    if verbose:
        print(f"\n🔍 Dự đoán {total} ảnh trong {folder.name}/\n")
        print(f"{'Tên file':<35} {'Dự đoán':<14} {'Độ tin cậy':>10}")
        print("─" * 65)

    for img_path in images:
        result = predict_single(img_path, model)
        result["file"] = str(img_path)

        # Kiểm tra nếu tên thư mục cha là label
        parent_label = img_path.parent.name
        result["label"]   = parent_label if parent_label in CLASSES else None
        result["correct"] = (result["label"] == result["class"])
        if result["correct"]:
            correct += 1

        results.append(result)

        if verbose:
            status = "✅" if result["correct"] else ("❓" if not result["label"] else "❌")
            print(f"{status} {img_path.name:<33} {result['name_vi']:<14} {result['confidence']*100:>8.1f}%")

    if verbose and any(r["label"] for r in results):
        labeled = [r for r in results if r["label"]]
        acc = sum(r["correct"] for r in labeled) / len(labeled) * 100
        print(f"\n  Accuracy: {acc:.1f}%  ({sum(r['correct'] for r in labeled)}/{len(labeled)})")

    return results
=======
"""
utils/predict_utils.py
======================
Tiện ích dự đoán ảnh đơn lẻ và hàng loạt.
"""

import numpy as np
import cv2
from pathlib import Path
from PIL import Image
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CLASSES, CLASS_INFO, IMG_SIZE, USE_CLAHE, USE_DENOISE
from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

def apply_advanced_filters_array(arr: np.ndarray) -> np.ndarray:
    """
    Áp dụng CLAHE và Noise Reduction cho Numpy Array (H, W, 3) RGB.
    Giúp tăng cường chi tiết cho ảnh chụp qua màn hình/nhòe.
    """
    # Xử lý datatype an toàn
    if arr.dtype != np.uint8:
        out_dtype = arr.dtype
        img_uint8 = np.clip(arr, 0, 255).astype(np.uint8)
    else:
        out_dtype = np.uint8
        img_uint8 = arr.copy()
        
    img_bgr = cv2.cvtColor(img_uint8, cv2.COLOR_RGB2BGR)
    
    # 1. Median Blur khử nhiễu
    if USE_DENOISE:
        img_bgr = cv2.medianBlur(img_bgr, 3)
        
    # 2. CLAHE cân bằng sáng
    if USE_CLAHE:
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        img_bgr = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return img_rgb.astype(out_dtype)


def get_custom_prep_fn(base_prep_fn):
    """
    Tạo hàm preprocessing dùng chung cho cả Generator (lúc train) và Inference (lúc test).
    """
    def custom_prep(x):
        # 1. Áp dụng filter (CLAHE/Denoise)
        x_filtered = apply_advanced_filters_array(x)
        # 2. Áp dụng model prep fn
        if base_prep_fn is not None:
             x_filtered = base_prep_fn(x_filtered)
        else:
             x_filtered = x_filtered / 255.0
        return x_filtered
    return custom_prep



def preprocess_image(source, img_size=None, backbone_name="efficientnetb3") -> np.ndarray:
    """
    Tiền xử lý ảnh từ file path hoặc PIL Image.

    Returns:
        np.ndarray shape (1, H, W, 3), dtype float32, đã qua prep_fn
    """
    size = img_size or IMG_SIZE
    if isinstance(source, (str, Path)):
        img = Image.open(source).convert("RGB")
    elif hasattr(source, 'read'): # File uploader handle
        img = Image.open(source).convert("RGB")
    elif isinstance(source, Image.Image):
        img = source.convert("RGB")
    else:
        img = source  # numpy array case handled below

    img = img.resize((size[1], size[0]), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)
    
    from utils.model import BACKBONES
    bname = backbone_name.lower()
    base_prep_fn = BACKBONES[bname].get("prep") if bname in BACKBONES else None
    
    # Sử dụng pipeline preprocessing chung
    prep_fn = get_custom_prep_fn(base_prep_fn)
    arr = prep_fn(arr)
        
    return np.expand_dims(arr, axis=0)


def predict_single(source, model) -> dict:
    """
    Dự đoán 1 ảnh.

    Returns:
        {
          "class": "rice",
          "name_vi": "Lúa",
          "confidence": 0.97,
          "top3": [{"rank":1, "class":"rice", "name_vi":"Lúa", "prob":0.97}, ...]
          "all": {"rice": 0.97, "corn": 0.01, ...}
        }
    """
    # Lấy backbone_name từ model
    bname = "efficientnetb3"
    if model.name.startswith("CropClassifier_"):
        bname = model.name.split("_", 1)[1]
        
    # Lấy input shape từ model
    _, h, w, _ = model.input_shape
    arr  = preprocess_image(source, img_size=(h, w), backbone_name=bname)
    prob = model.predict(arr, verbose=0)[0]

    top3_idx = np.argsort(prob)[::-1][:3]
    return {
        "class":      CLASSES[top3_idx[0]],
        "name_vi":    CLASS_INFO[CLASSES[top3_idx[0]]]["vi"],
        "confidence": float(prob[top3_idx[0]]),
        "top3": [
            {
                "rank":    i + 1,
                "class":   CLASSES[idx],
                "name_vi": CLASS_INFO[CLASSES[idx]]["vi"],
                "emoji":   CLASS_INFO[CLASSES[idx]]["emoji"],
                "prob":    float(prob[idx]),
            }
            for i, idx in enumerate(top3_idx)
        ],
        "all": {CLASSES[i]: float(prob[i]) for i in range(len(CLASSES))},
    }


def predict_batch(folder, model, verbose=True) -> list:
    """
    Dự đoán tất cả ảnh trong một thư mục.

    Returns:
        list of result dicts
    """
    folder = Path(folder)
    images = [f for f in folder.rglob("*") if f.suffix.lower() in SUPPORTED_EXTS]

    if not images:
        print(f"⚠️  Không tìm thấy ảnh trong: {folder}")
        return []

    results = []
    correct = 0
    total   = len(images)

    if verbose:
        print(f"\n🔍 Dự đoán {total} ảnh trong {folder.name}/\n")
        print(f"{'Tên file':<35} {'Dự đoán':<14} {'Độ tin cậy':>10}")
        print("─" * 65)

    for img_path in images:
        result = predict_single(img_path, model)
        result["file"] = str(img_path)

        # Kiểm tra nếu tên thư mục cha là label
        parent_label = img_path.parent.name
        result["label"]   = parent_label if parent_label in CLASSES else None
        result["correct"] = (result["label"] == result["class"])
        if result["correct"]:
            correct += 1

        results.append(result)

        if verbose:
            status = "✅" if result["correct"] else ("❓" if not result["label"] else "❌")
            print(f"{status} {img_path.name:<33} {result['name_vi']:<14} {result['confidence']*100:>8.1f}%")

    if verbose and any(r["label"] for r in results):
        labeled = [r for r in results if r["label"]]
        acc = sum(r["correct"] for r in labeled) / len(labeled) * 100
        print(f"\n  Accuracy: {acc:.1f}%  ({sum(r['correct'] for r in labeled)}/{len(labeled)})")

    return results
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
