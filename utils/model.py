"""
utils/model.py
==============
Xây dựng mô hình với nhiều lựa chọn backbone.

Cách dùng:
    from utils.model import build_model, unfreeze_model
    model, base = build_model("mobilenetv2")
    unfreeze_model(base, n_layers=30)
"""

import tensorflow as tf
from tensorflow.keras import layers, models
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import NUM_CLASSES, INPUT_SHAPE, DROPOUT_RATE, UNFREEZE_LAYERS


# ── Backbone registry ────────────────────────────────────
BACKBONES = {
    "mobilenetv2": {
        "fn":    tf.keras.applications.MobileNetV2,
        "prep":  tf.keras.applications.mobilenet_v2.preprocess_input,
        "size":  (224, 224),
        "desc":  "Nhẹ, nhanh — tốt cho thiết bị yếu",
    },
    "efficientnetb0": {
        "fn":    tf.keras.applications.EfficientNetB0,
        "prep":  tf.keras.applications.efficientnet.preprocess_input,
        "size":  (224, 224),
        "desc":  "Cân bằng tốc độ và accuracy",
    },
    "efficientnetb3": {
        "fn":    tf.keras.applications.EfficientNetB3,
        "prep":  tf.keras.applications.efficientnet.preprocess_input,
        "size":  (300, 300),
        "desc":  "Accuracy cao hơn, cần máy mạnh hơn",
    },
    "resnet50": {
        "fn":    tf.keras.applications.ResNet50,
        "prep":  tf.keras.applications.resnet50.preprocess_input,
        "size":  (224, 224),
        "desc":  "Kinh điển, ổn định",
    },
    "inceptionv3": {
        "fn":    tf.keras.applications.InceptionV3,
        "prep":  tf.keras.applications.inception_v3.preprocess_input,
        "size":  (299, 299),
        "desc":  "Tốt cho ảnh có chi tiết nhỏ",
    },
    "densenet121": {
        "fn":    tf.keras.applications.DenseNet121,
        "prep":  tf.keras.applications.densenet.preprocess_input,
        "size":  (224, 224),
        "desc":  "Kết nối dày đặc, ít overfit",
    },
    "efficientnetv2s": {
        "fn":    tf.keras.applications.EfficientNetV2S,
        "prep":  tf.keras.applications.efficientnet_v2.preprocess_input,
        "size":  (384, 384),
        "desc":  "Siêu não bộ thế hệ mới - Mạnh mẽ và chính xác nhất",
    },
}


def list_backbones():
    """In danh sách backbone có sẵn."""
    print(f"\n{'Backbone':<18} {'Kích thước':>12}  Mô tả")
    print("─" * 65)
    for name, info in BACKBONES.items():
        print(f"  {name:<16} {str(info['size']):>12}  {info['desc']}")


def build_model(backbone_name="mobilenetv2", num_classes=NUM_CLASSES):
    """
    Xây dựng mô hình Transfer Learning.

    Args:
        backbone_name: tên backbone (xem list_backbones())
        num_classes:   số lớp phân loại

    Returns:
        (model, base_model)
    """
    bname = backbone_name.lower()
    if bname not in BACKBONES:
        raise ValueError(f"Backbone '{backbone_name}' không hợp lệ. Chọn: {list(BACKBONES.keys())}")

    info = BACKBONES[bname]
    h, w = info["size"]
    input_shape = (h, w, 3)

    # Tải pretrained backbone
    base_model = info["fn"](
        input_shape=input_shape,
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False  # Đóng băng giai đoạn 1

    # Xây dựng head phân loại
    inputs  = layers.Input(shape=input_shape, name="input_image")
    
    # Quan trọng: Không để training=False cứng ở đây. 
    # Keras sẽ tự động quản lý flag này dựa trên base_model.trainable và model.fit()
    x       = base_model(inputs) 
    
    x       = layers.GlobalAveragePooling2D(name="gap")(x)
    x       = layers.Dense(512, name="dense_512")(x)
    x       = layers.BatchNormalization(name="bn_1")(x)
    x       = layers.Activation("relu", name="relu_1")(x)
    x       = layers.Dropout(DROPOUT_RATE, name="dropout_1")(x)
    x       = layers.Dense(256, name="dense_256")(x)
    x       = layers.BatchNormalization(name="bn_2")(x)
    x       = layers.Activation("relu", name="relu_2")(x)
    x       = layers.Dropout(DROPOUT_RATE / 2, name="dropout_2")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    model = models.Model(inputs, outputs, name=f"CropClassifier_{bname}")

    # Summary
    total     = model.count_params()
    trainable = sum(l.count_params() for l in model.layers if l.trainable)
    frozen    = total - trainable
    print(f"\nModel: {model.name}")
    print(f"   Backbone:    {bname}  ({h}x{w})")
    print(f"   Total params: {total:,}")
    print(f"   Trainable:   {trainable:,}")
    print(f"   Frozen:      {frozen:,}")

    return model, base_model


def unfreeze_model(base_model, n_layers=UNFREEZE_LAYERS):
    """
    Unfreeze last n layers for fine-tuning.
    """
    base_model.trainable = True
    for layer in base_model.layers[:-n_layers]:
        layer.trainable = False

    opened = sum(1 for l in base_model.layers if l.trainable)
    print(f"Unfrozen {opened}/{len(base_model.layers)} layers of the base model")


def load_model(path):
    """Tải mô hình đã lưu."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(
            f"Không tìm thấy: {p}\n"
            "Hãy chạy train trước: python train.py"
        )
    print(f"📦 Đang tải: {p.name} ...")
    return tf.keras.models.load_model(str(p))
