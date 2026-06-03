<<<<<<< HEAD
"""
train.py
========
Script huấn luyện chính.

Cách dùng:
    python train.py
    python train.py --backbone efficientnetb3
    python train.py --list-backbones
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

import numpy as np
import tensorflow as tf

from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from config import (
    EPOCHS_FROZEN, EPOCHS_FINETUNE, LEARNING_RATE, FINETUNE_LR,
    PATIENCE, BEST_MODEL_PATH, LAST_MODEL_PATH, HISTORY_PATH,
    BATCH_SIZE, MODEL_DIR,
)
from utils.dataset  import create_generators, get_class_weights, dataset_stats
from utils.model    import build_model, unfreeze_model, list_backbones
from utils.evaluate import evaluate_model, plot_confusion_matrix, plot_history


# ── Callbacks ────────────────────────────────────────────
def get_callbacks():
    from tensorflow.keras.callbacks import (
        EarlyStopping, ModelCheckpoint,
        ReduceLROnPlateau, CSVLogger,
    )
    return [
        EarlyStopping(
            monitor="val_accuracy",
            patience=PATIENCE,
            restore_best_weights=True,
            verbose=1,
            min_delta=1e-4,
        ),
        ModelCheckpoint(
            filepath=str(BEST_MODEL_PATH),
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1,
        ),
        ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=3,
            min_lr=1e-8,
            verbose=1,
        ),
        CSVLogger(str(MODEL_DIR / "training_log.csv"), append=True),
    ]


# -- Training ---------------------------------------------
def train(args):
    print("=" * 60)
    print("  Crop Recognition AI - Model Training")
    print("=" * 60)
    print(f"  TensorFlow : {tf.__version__}")
    gpus = tf.config.list_physical_devices("GPU")
    print(f"  GPU        : {[g.name for g in gpus] if gpus else 'None (using CPU)'}")
    print(f"  Backbone   : {args.backbone}")
    print(f"  Batch size : {args.batch}")

    # -- 1. Data -----------------------------------------
    print("\nLoading data...")
    train_gen, val_gen, test_gen = create_generators(backbone_name=args.backbone, augment=True)
    class_weights = get_class_weights(train_gen)
    print(f"  Class weights: {class_weights}")

    # -- 2. Build or Resume model -----------------------
    if args.resume:
        print(f"\n📦 Đang tải và phục hồi mô hình từ: {args.resume} ...")
        try:
            old_model = tf.keras.models.load_model(args.resume, compile=False)
            model_loaded = True
        except Exception as e:
            print(f"⚠️ Không thể tải trực tiếp mô hình qua load_model: {e}")
            print("🔄 Đang thử tải cấu trúc backbone và nạp trọng số (weights) thay thế...")
            model_loaded = False

        if model_loaded:
            # Verify input shape matches current backbone
            model_input_shape = old_model.input_shape[1:3]
            gen_image_shape = train_gen.image_shape[0:2]
            if model_input_shape != gen_image_shape:
                print(f"❌ Lỗi: Kích thước ảnh của mô hình cũ {model_input_shape} không khớp với backbone hiện tại {gen_image_shape}.")
                print(f"Vui lòng chạy lại với flag '--backbone' thích hợp cho mô hình cũ.")
                sys.exit(1)
                
            num_classes = len(train_gen.class_indices)
            if old_model.output_shape[-1] == num_classes:
                print("✅ Số lượng lớp trùng khớp. Tiếp tục huấn luyện mô hình gốc.")
                model = old_model
                # Get base model (usually layer at index 1)
                base_model = old_model.layers[1]
            else:
                print(f"⚠️ Số lượng lớp không trùng khớp ({old_model.output_shape[-1]} lớp cũ vs {num_classes} lớp mới).")
                print("🔧 Đang tự động thay thế lớp phân loại cuối cùng...")
                
                # Reconstruct model layers up to dropout_2 (layer index 10)
                x = old_model.layers[10].output
                new_predictions = tf.keras.layers.Dense(num_classes, activation="softmax", name="predictions")(x)
                model = tf.keras.models.Model(inputs=old_model.input, outputs=new_predictions, name=old_model.name)
                base_model = old_model.layers[1]
                
                # Freeze base model for Phase 1 since the head is newly initialized
                base_model.trainable = False
        else:
            num_classes = len(train_gen.class_indices)
            model, base_model = build_model(args.backbone, num_classes=num_classes)
            try:
                model.load_weights(args.resume, by_name=True, skip_mismatch=True)
                print("✅ Nạp trọng số (weights) thành công!")
            except Exception as w_err:
                print(f"❌ Không thể nạp trọng số: {w_err}")
                sys.exit(1)
            
            # Freeze base model for Phase 1 since the head is newly initialized/modified
            base_model.trainable = False
    else:
        model, base_model = build_model(args.backbone)

    # -- 3. Phase 1: Frozen base -------------------------
    print("\n" + "-" * 60)
    print("  Phase 1: Training classifier (base frozen)")
    print("-" * 60)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=args.lr),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks = get_callbacks()

    hist1 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=args.epochs_frozen,
        callbacks=callbacks,
        class_weight=class_weights,
        verbose=1,
    )

    # -- 4. Phase 2: Fine-tune ---------------------------
    print("\n" + "-" * 60)
    print("  Phase 2: Fine-tuning entire model")
    print("-" * 60)

    unfreeze_model(base_model, n_layers=args.unfreeze)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=args.fine_lr),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks2 = get_callbacks()

    hist2 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=args.epochs_fine,
        callbacks=callbacks2,
        class_weight=class_weights,
        verbose=1,
    )

    # -- 5. Save history ---------------------------------
    full_history = {}
    for key in ["loss", "accuracy", "val_loss", "val_accuracy"]:
        full_history[key] = (
            hist1.history.get(key, []) + hist2.history.get(key, [])
        )
    with open(HISTORY_PATH, "w") as f:
        json.dump(full_history, f, indent=2)

    # -- 6. Evaluation -----------------------------------
    print("\n" + "-" * 60)
    print("  Evaluation on Test set")
    print("-" * 60)

    result = evaluate_model(model, test_gen, verbose=True)
    plot_confusion_matrix(result["y_true"], result["y_pred"], save=True)
    plot_history(full_history, save=True)

    # Save results
    eval_path = MODEL_DIR / "eval_results.json"
    with open(eval_path, "w") as f:
        json.dump({
            "backbone":   args.backbone,
            "accuracy":   result["accuracy"],
            "f1":         result["f1"],
            "trained_at": datetime.now().isoformat(),
        }, f, indent=2)

    # -- 7. Save final model -----------------------------
    model.save(str(LAST_MODEL_PATH))

    print("\n" + "=" * 60)
    print(f"  DONE! Accuracy: {result['accuracy']*100:.2f}%")
    print(f"  Best model saved to: {BEST_MODEL_PATH}")
    print(f"  Last model saved to: {LAST_MODEL_PATH}")
    print(f"\n  Run demo: python api.py")
    print("=" * 60)


# -- CLI ---------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train crop recognition model",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--backbone",      default="efficientnetb3")
    parser.add_argument("--resume",        default=None, help="Đường dẫn tới file model .h5 đã train trước đó để tiếp tục train")
    parser.add_argument("--epochs-frozen", dest="epochs_frozen", type=int, default=EPOCHS_FROZEN)
    parser.add_argument("--epochs-fine",   dest="epochs_fine",   type=int, default=EPOCHS_FINETUNE)
    parser.add_argument("--batch",         type=int,   default=BATCH_SIZE)
    parser.add_argument("--lr",            type=float, default=LEARNING_RATE)
    parser.add_argument("--fine-lr",       dest="fine_lr", type=float, default=FINETUNE_LR)
    parser.add_argument("--unfreeze",      type=int,   default=50)
    parser.add_argument("--list-backbones", action="store_true")

    args = parser.parse_args()

    if args.list_backbones:
        list_backbones()
        sys.exit(0)

    train(args)

=======
"""
train.py
========
Script huấn luyện chính.

Cách dùng:
    python train.py
    python train.py --backbone efficientnetb3
    python train.py --list-backbones
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

import numpy as np
import tensorflow as tf

from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from config import (
    EPOCHS_FROZEN, EPOCHS_FINETUNE, LEARNING_RATE, FINETUNE_LR,
    PATIENCE, BEST_MODEL_PATH, LAST_MODEL_PATH, HISTORY_PATH,
    BATCH_SIZE, MODEL_DIR,
)
from utils.dataset  import create_generators, get_class_weights, dataset_stats
from utils.model    import build_model, unfreeze_model, list_backbones
from utils.evaluate import evaluate_model, plot_confusion_matrix, plot_history


# ── Callbacks ────────────────────────────────────────────
def get_callbacks():
    from tensorflow.keras.callbacks import (
        EarlyStopping, ModelCheckpoint,
        ReduceLROnPlateau, CSVLogger,
    )
    return [
        EarlyStopping(
            monitor="val_accuracy",
            patience=PATIENCE,
            restore_best_weights=True,
            verbose=1,
            min_delta=1e-4,
        ),
        ModelCheckpoint(
            filepath=str(BEST_MODEL_PATH),
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1,
        ),
        ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=3,
            min_lr=1e-8,
            verbose=1,
        ),
        CSVLogger(str(MODEL_DIR / "training_log.csv"), append=True),
    ]


# -- Training ---------------------------------------------
def train(args):
    print("=" * 60)
    print("  Crop Recognition AI - Model Training")
    print("=" * 60)
    print(f"  TensorFlow : {tf.__version__}")
    gpus = tf.config.list_physical_devices("GPU")
    print(f"  GPU        : {[g.name for g in gpus] if gpus else 'None (using CPU)'}")
    print(f"  Backbone   : {args.backbone}")
    print(f"  Batch size : {args.batch}")

    # -- 1. Data -----------------------------------------
    print("\nLoading data...")
    train_gen, val_gen, test_gen = create_generators(backbone_name=args.backbone, augment=True)
    class_weights = get_class_weights(train_gen)
    print(f"  Class weights: {class_weights}")

    # -- 2. Build or Resume model -----------------------
    if args.resume:
        print(f"\n📦 Đang tải và phục hồi mô hình từ: {args.resume} ...")
        try:
            old_model = tf.keras.models.load_model(args.resume, compile=False)
            model_loaded = True
        except Exception as e:
            print(f"⚠️ Không thể tải trực tiếp mô hình qua load_model: {e}")
            print("🔄 Đang thử tải cấu trúc backbone và nạp trọng số (weights) thay thế...")
            model_loaded = False

        if model_loaded:
            # Verify input shape matches current backbone
            model_input_shape = old_model.input_shape[1:3]
            gen_image_shape = train_gen.image_shape[0:2]
            if model_input_shape != gen_image_shape:
                print(f"❌ Lỗi: Kích thước ảnh của mô hình cũ {model_input_shape} không khớp với backbone hiện tại {gen_image_shape}.")
                print(f"Vui lòng chạy lại với flag '--backbone' thích hợp cho mô hình cũ.")
                sys.exit(1)
                
            num_classes = len(train_gen.class_indices)
            if old_model.output_shape[-1] == num_classes:
                print("✅ Số lượng lớp trùng khớp. Tiếp tục huấn luyện mô hình gốc.")
                model = old_model
                # Get base model (usually layer at index 1)
                base_model = old_model.layers[1]
            else:
                print(f"⚠️ Số lượng lớp không trùng khớp ({old_model.output_shape[-1]} lớp cũ vs {num_classes} lớp mới).")
                print("🔧 Đang tự động thay thế lớp phân loại cuối cùng...")
                
                # Reconstruct model layers up to dropout_2 (layer index 10)
                x = old_model.layers[10].output
                new_predictions = tf.keras.layers.Dense(num_classes, activation="softmax", name="predictions")(x)
                model = tf.keras.models.Model(inputs=old_model.input, outputs=new_predictions, name=old_model.name)
                base_model = old_model.layers[1]
                
                # Freeze base model for Phase 1 since the head is newly initialized
                base_model.trainable = False
        else:
            num_classes = len(train_gen.class_indices)
            model, base_model = build_model(args.backbone, num_classes=num_classes)
            try:
                model.load_weights(args.resume, by_name=True, skip_mismatch=True)
                print("✅ Nạp trọng số (weights) thành công!")
            except Exception as w_err:
                print(f"❌ Không thể nạp trọng số: {w_err}")
                sys.exit(1)
            
            # Freeze base model for Phase 1 since the head is newly initialized/modified
            base_model.trainable = False
    else:
        model, base_model = build_model(args.backbone)

    # -- 3. Phase 1: Frozen base -------------------------
    print("\n" + "-" * 60)
    print("  Phase 1: Training classifier (base frozen)")
    print("-" * 60)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=args.lr),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks = get_callbacks()

    hist1 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=args.epochs_frozen,
        callbacks=callbacks,
        class_weight=class_weights,
        verbose=1,
    )

    # -- 4. Phase 2: Fine-tune ---------------------------
    print("\n" + "-" * 60)
    print("  Phase 2: Fine-tuning entire model")
    print("-" * 60)

    unfreeze_model(base_model, n_layers=args.unfreeze)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=args.fine_lr),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks2 = get_callbacks()

    hist2 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=args.epochs_fine,
        callbacks=callbacks2,
        class_weight=class_weights,
        verbose=1,
    )

    # -- 5. Save history ---------------------------------
    full_history = {}
    for key in ["loss", "accuracy", "val_loss", "val_accuracy"]:
        full_history[key] = (
            hist1.history.get(key, []) + hist2.history.get(key, [])
        )
    with open(HISTORY_PATH, "w") as f:
        json.dump(full_history, f, indent=2)

    # -- 6. Evaluation -----------------------------------
    print("\n" + "-" * 60)
    print("  Evaluation on Test set")
    print("-" * 60)

    result = evaluate_model(model, test_gen, verbose=True)
    plot_confusion_matrix(result["y_true"], result["y_pred"], save=True)
    plot_history(full_history, save=True)

    # Save results
    eval_path = MODEL_DIR / "eval_results.json"
    with open(eval_path, "w") as f:
        json.dump({
            "backbone":   args.backbone,
            "accuracy":   result["accuracy"],
            "f1":         result["f1"],
            "trained_at": datetime.now().isoformat(),
        }, f, indent=2)

    # -- 7. Save final model -----------------------------
    model.save(str(LAST_MODEL_PATH))

    print("\n" + "=" * 60)
    print(f"  DONE! Accuracy: {result['accuracy']*100:.2f}%")
    print(f"  Best model saved to: {BEST_MODEL_PATH}")
    print(f"  Last model saved to: {LAST_MODEL_PATH}")
    print(f"\n  Run demo: python api.py")
    print("=" * 60)


# -- CLI ---------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train crop recognition model",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--backbone",      default="efficientnetb3")
    parser.add_argument("--resume",        default=None, help="Đường dẫn tới file model .h5 đã train trước đó để tiếp tục train")
    parser.add_argument("--epochs-frozen", dest="epochs_frozen", type=int, default=EPOCHS_FROZEN)
    parser.add_argument("--epochs-fine",   dest="epochs_fine",   type=int, default=EPOCHS_FINETUNE)
    parser.add_argument("--batch",         type=int,   default=BATCH_SIZE)
    parser.add_argument("--lr",            type=float, default=LEARNING_RATE)
    parser.add_argument("--fine-lr",       dest="fine_lr", type=float, default=FINETUNE_LR)
    parser.add_argument("--unfreeze",      type=int,   default=50)
    parser.add_argument("--list-backbones", action="store_true")

    args = parser.parse_args()

    if args.list_backbones:
        list_backbones()
        sys.exit(0)

    train(args)

>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
