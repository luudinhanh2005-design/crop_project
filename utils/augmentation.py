"""
utils/augmentation.py
=====================
Các kỹ thuật augmentation nâng cao: Mixup, CutMix, TTA.
"""

import numpy as np
from PIL import Image, ImageOps, ImageFilter
import tensorflow as tf
from pathlib import Path


# ── Mixup ────────────────────────────────────────────────
def mixup_generator(generator, alpha=0.2):
    """
    Trộn 2 ảnh + nhãn theo tỷ lệ beta distribution.
    Giúp mô hình học ranh giới mềm hơn giữa các lớp.
    """
    while True:
        X1, y1 = next(generator)
        X2, y2 = next(generator)
        bs = min(len(X1), len(X2))
        X1, y1 = X1[:bs], y1[:bs]
        X2, y2 = X2[:bs], y2[:bs]

        lam = np.random.beta(alpha, alpha, size=(bs, 1, 1, 1)).astype(np.float32)
        X_mix = lam * X1 + (1 - lam) * X2
        y_mix = lam[:, 0, 0, :] * y1 + (1 - lam[:, 0, 0, :]) * y2
        yield X_mix, y_mix


# ── CutMix ───────────────────────────────────────────────
def cutmix_generator(generator, alpha=1.0):
    """
    Cắt một vùng hình chữ nhật ngẫu nhiên từ ảnh 2 và dán vào ảnh 1.
    Nhãn được pha trộn theo tỷ lệ diện tích cắt.
    """
    while True:
        X1, y1 = next(generator)
        X2, y2 = next(generator)
        bs = min(len(X1), len(X2))
        X1, y1 = X1[:bs], y1[:bs]
        X2, y2 = X2[:bs], y2[:bs]

        H, W = X1.shape[1], X1.shape[2]
        lam   = np.random.beta(alpha, alpha)
        cut_w = int(W * np.sqrt(1 - lam))
        cut_h = int(H * np.sqrt(1 - lam))
        cx    = np.random.randint(W)
        cy    = np.random.randint(H)
        x1 = np.clip(cx - cut_w // 2, 0, W)
        x2 = np.clip(cx + cut_w // 2, 0, W)
        y1b = np.clip(cy - cut_h // 2, 0, H)
        y2b = np.clip(cy + cut_h // 2, 0, H)

        X_cut = X1.copy()
        X_cut[:, y1b:y2b, x1:x2, :] = X2[:, y1b:y2b, x1:x2, :]
        real_lam = 1 - ((x2 - x1) * (y2b - y1b)) / (W * H)
        y_cut = real_lam * y1 + (1 - real_lam) * y2
        yield X_cut, y_cut


# ── Test Time Augmentation (TTA) ─────────────────────────
class TTA:
    """
    Tạo nhiều biến thể của 1 ảnh khi predict,
    rồi lấy trung bình để giảm sai số.
    """
    def __init__(self, model, n_augments=8):
        self.model = model
        self.n     = n_augments

    def _augment(self, img: Image.Image) -> Image.Image:
        ops = []
        if np.random.rand() > 0.5:
            ops.append(lambda x: ImageOps.mirror(x))
        if np.random.rand() > 0.5:
            ops.append(lambda x: ImageOps.flip(x))
        angle = np.random.uniform(-20, 20)
        ops.append(lambda x, a=angle: x.rotate(a))
        brightness = np.random.uniform(0.8, 1.2)
        ops.append(lambda x, b=brightness: ImageOps.autocontrast(x) if b > 1.1 else x)
        for op in ops:
            img = op(img)
        return img

    def predict(self, image_path, img_size=None) -> np.ndarray:
        """Dự đoán với TTA, trả về mảng xác suất trung bình."""
        from utils.model import BACKBONES
        bname = "efficientnetb3"
        if self.model.name.startswith("CropClassifier_"):
            bname = self.model.name.split("_", 1)[1]
            
        if img_size is None:
            if bname in BACKBONES:
                img_size = BACKBONES[bname]["size"]
            else:
                img_size = (224, 224)
                
        if isinstance(image_path, (str, Path)):
            img = Image.open(image_path).convert("RGB")
        elif hasattr(image_path, "read"):
            img = Image.open(image_path).convert("RGB")
        elif isinstance(image_path, Image.Image):
            img = image_path.convert("RGB")
        else:
            img = image_path

        img = img.resize(img_size, Image.LANCZOS)
        
        preds = []
        for _ in range(self.n):
            aug = self._augment(img)
            arr = np.array(aug, dtype=np.float32)
            
            if bname in BACKBONES and BACKBONES[bname].get("prep"):
                arr = BACKBONES[bname]["prep"](arr)
            else:
                arr = arr / 255.0
                
            arr = np.expand_dims(arr, 0)
            preds.append(self.model.predict(arr, verbose=0)[0])
        return np.mean(preds, axis=0)


# ── Gaussian Noise ───────────────────────────────────────
class GaussianNoise(tf.keras.layers.Layer):
    """Layer thêm nhiễu Gaussian trong quá trình training."""
    def __init__(self, stddev=0.05, **kwargs):
        super().__init__(**kwargs)
        self.stddev = stddev

    def call(self, x, training=None):
        if training:
            noise = tf.random.normal(shape=tf.shape(x), stddev=self.stddev)
            return x + noise
        return x

    def get_config(self):
        return {**super().get_config(), "stddev": self.stddev}
