import os
import sys
import json
from pathlib import Path
import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras import layers, models
from PIL import ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data_specialist"
MODEL_DIR = ROOT_DIR / "models"
BEST_MODEL_PATH = MODEL_DIR / "crops_specialist_best.keras"

TARGET_CLASSES = [
    "soybean_product",
    "sugarcane_product",
    "sweet_potato_product",
    "wheat_product",
    "wheat_stalk"
]

IMG_SIZE = (384, 384)
BATCH_SIZE = 12

def get_callbacks():
    from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
    return [
        EarlyStopping(
            monitor="val_accuracy",
            patience=5,
            restore_best_weights=True,
            verbose=1,
            min_delta=1e-4
        ),
        ModelCheckpoint(
            filepath=str(BEST_MODEL_PATH),
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=2,
            min_lr=1e-8,
            verbose=1
        )
    ]

def build_model():
    print("\n📦 Đang khởi tạo mô hình chuyên gia EfficientNetV2-S (15 lớp)...")
    base_model = tf.keras.applications.EfficientNetV2S(
        include_top=False,
        weights="imagenet",
        input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3),
        pooling="avg"
    )
    
    # Đóng băng xương sống cho Phase 1
    base_model.trainable = False
    
    model = models.Sequential([
        base_model,
        layers.Dropout(0.5),
        layers.Dense(5, activation="softmax", name="predictions")
    ], name="Crops_Specialist_Model")
    
    return model, base_model

def train():
    print("=" * 60)
    print("  Huấn luyện Mô hình Chuyên gia 15 lớp (5 nhóm cây yếu)")
    print("=" * 60)
    print(f"TensorFlow Version: {tf.__version__}")
    gpus = tf.config.list_physical_devices("GPU")
    print(f"GPU Mode: {[g.name for g in gpus] if gpus else 'None (CPU)'}")
    
    # Tiền xử lý theo EfficientNetV2
    prep_fn = tf.keras.applications.efficientnet_v2.preprocess_input
    
    train_datagen = ImageDataGenerator(
        preprocessing_function=prep_fn,
        rotation_range=50,
        width_shift_range=0.3,
        height_shift_range=0.3,
        shear_range=0.2,
        zoom_range=0.35,
        horizontal_flip=True,
        vertical_flip=True,
        brightness_range=[0.5, 1.5],
        fill_mode="nearest"
    )
    
    val_test_datagen = ImageDataGenerator(preprocessing_function=prep_fn)
    
    common_flow = dict(
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        classes=TARGET_CLASSES
    )
    
    print("\nĐang nạp dữ liệu máy phát (Generators)...")
    train_gen = train_datagen.flow_from_directory(DATA_DIR / "train", shuffle=True, **common_flow)
    val_gen = val_test_datagen.flow_from_directory(DATA_DIR / "val", shuffle=False, **common_flow)
    test_gen = val_test_datagen.flow_from_directory(DATA_DIR / "test", shuffle=False, **common_flow)
    
    model, base_model = build_model()
    
    # Phase 1: Train Classifier Only
    print("\n" + "-" * 50)
    print("  Phase 1: Huấn luyện bộ phân loại (Đóng băng backbone)")
    print("-" * 50)
    
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    
    model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=5,
        callbacks=get_callbacks(),
        verbose=1
    )
    
    # Phase 2: Fine-tune backbone
    print("\n" + "-" * 50)
    print("  Phase 2: Fine-tuning toàn bộ mô hình (Mở khóa backbone)")
    print("-" * 50)
    
    # Mở khóa các tầng trên cùng của backbone
    base_model.trainable = True
    # Đóng băng các tầng dưới, mở khóa 50 tầng cuối cùng
    for layer in base_model.layers[:-50]:
        layer.trainable = False
        
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    
    model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=15,
        callbacks=get_callbacks(),
        verbose=1
    )
    
    # Đánh giá trên tập test sạch
    print("\n" + "-" * 50)
    print("  Đánh giá mô hình trên tập Test độc lập")
    print("-" * 50)
    loss, acc = model.evaluate(test_gen)
    print(f"\n📊 Kết quả test mô hình chuyên gia: Loss: {loss:.4f} | Accuracy: {acc*100:.2f}%")
    print(f"✅ Mô hình chuyên gia tốt nhất được lưu tại: {BEST_MODEL_PATH}")

if __name__ == "__main__":
    train()
