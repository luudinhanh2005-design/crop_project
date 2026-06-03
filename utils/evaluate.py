"""
utils/evaluate.py
=================
Đánh giá mô hình: accuracy, confusion matrix, classification report.
"""

import json
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CLASSES, CLASS_INFO, MODEL_DIR


# ── Đánh giá tập test ─────────────────────────────────────
def evaluate_model(model, test_gen, verbose=True):
    """
    Chạy model trên tập test, in report chi tiết.

    Returns:
        dict: {accuracy, report_str, y_true, y_pred, probs}
    """
    from sklearn.metrics import (
        classification_report, confusion_matrix,
        accuracy_score, f1_score,
    )

    test_gen.reset()
    probs  = model.predict(test_gen, verbose=1 if verbose else 0)
    y_pred = np.argmax(probs, axis=1)
    y_true = test_gen.classes[:len(y_pred)]

    acc    = accuracy_score(y_true, y_pred)
    f1     = f1_score(y_true, y_pred, average="weighted")

    en_names = [CLASS_INFO[c]["en"] for c in CLASSES]
    all_labels = list(range(len(CLASSES)))
    report   = classification_report(y_true, y_pred, target_names=en_names, labels=all_labels, zero_division=0)

    if verbose:
        print(f"\nAccuracy:  {acc*100:.2f}%")
        print(f"   F1 Score:  {f1*100:.2f}%")
        print(f"\n{report}")

    return {
        "accuracy": acc, "f1": f1,
        "report":   report,
        "y_true":   y_true, "y_pred": y_pred, "probs": probs,
    }


# -- Confusion Matrix --------------------------------------
def plot_confusion_matrix(y_true, y_pred, save=True, show=False):
    """Vẽ và lưu confusion matrix."""
    from sklearn.metrics import confusion_matrix
    all_labels = list(range(len(CLASSES)))
    cm = confusion_matrix(y_true, y_pred, labels=all_labels)
    vn = [CLASS_INFO[c]["vi"] for c in CLASSES]

    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(
        cm, annot=True, fmt="d",
        xticklabels=vn, yticklabels=vn,
        cmap="Blues", linewidths=0.4,
        ax=ax,
    )
    ax.set_title("Confusion Matrix", fontsize=14, pad=15)
    ax.set_ylabel("Actual", fontsize=12)
    ax.set_xlabel("Predicted", fontsize=12)
    plt.xticks(rotation=35, ha="right")
    plt.tight_layout()

    if save:
        path = MODEL_DIR / "confusion_matrix.png"
        fig.savefig(path, dpi=150, bbox_inches="tight")
        print(f"Confusion matrix saved to: {path}")
    if show:
        plt.show()
    plt.close()
    return cm


# -- Training History Plot --------------------------------
def plot_history(history_data, save=True, show=False):
    """
    Vẽ đồ thị accuracy & loss qua các epoch.
    """
    if isinstance(history_data, (str, Path)):
        with open(history_data) as f:
            history_data = json.load(f)

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("Training Process", fontsize=14)

    epochs = range(1, len(history_data.get("accuracy", [])) + 1)
    colors = {"train": "#1976D2", "val": "#E64A19"}

    # Accuracy
    axes[0].plot(epochs, history_data.get("accuracy", []),
                 color=colors["train"], label="Train", linewidth=2)
    axes[0].plot(epochs, history_data.get("val_accuracy", []),
                 color=colors["val"], label="Validation", linewidth=2, linestyle="--")
    axes[0].set_title("Accuracy")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Accuracy")
    axes[0].legend()
    axes[0].grid(alpha=0.3)
    axes[0].set_ylim(0, 1.05)

    # Loss
    axes[1].plot(epochs, history_data.get("loss", []),
                 color=colors["train"], label="Train", linewidth=2)
    axes[1].plot(epochs, history_data.get("val_loss", []),
                 color=colors["val"], label="Validation", linewidth=2, linestyle="--")
    axes[1].set_title("Loss")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Loss")
    axes[1].legend()
    axes[1].grid(alpha=0.3)

    plt.tight_layout()

    if save:
        path = MODEL_DIR / "training_history.png"
        fig.savefig(path, dpi=150, bbox_inches="tight")
        print(f"Training history plot saved to: {path}")
    if show:
        plt.show()
    plt.close()


# -- Grad-CAM ----------------------------------------------
def grad_cam(model, image_array, class_idx, layer_name=None):
    """
    Tạo Grad-CAM heatmap để giải thích mô hình đang nhìn vào đâu.
    """
    import tensorflow as tf

    if layer_name is None:
        # Tìm lớp Conv2D cuối cùng
        for layer in reversed(model.layers):
            if isinstance(layer, tf.keras.layers.Conv2D):
                layer_name = layer.name
                break

    grad_model = tf.keras.models.Model(
        inputs=model.inputs,
        outputs=[model.get_layer(layer_name).output, model.output],
    )
    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(image_array)
        loss = predictions[:, class_idx]

    grads   = tape.gradient(loss, conv_outputs)
    weights = tf.reduce_mean(grads, axis=(0, 1, 2))
    cam     = tf.reduce_sum(conv_outputs[0] * weights, axis=-1).numpy()
    cam     = np.maximum(cam, 0)
    cam     = cam / (cam.max() + 1e-8)
    return cam


def visualize_gradcam(model, image_path, class_idx, save_path=None):
    """Vẽ ảnh gốc + Grad-CAM overlay."""
    from PIL import Image
    import cv2

    img  = Image.open(image_path).convert("RGB").resize((224, 224))
    arr  = np.array(img, dtype=np.float32) / 255.0
    inp  = np.expand_dims(arr, 0)

    cam  = grad_cam(model, inp, class_idx)
    cam_resized = np.array(Image.fromarray((cam * 255).astype(np.uint8)).resize((224, 224)))

    heatmap = cv2.applyColorMap(cam_resized, cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB) / 255.0
    overlay = 0.4 * heatmap + 0.6 * arr

    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    axes[0].imshow(arr);         axes[0].set_title("Original")
    axes[1].imshow(cam, cmap="jet"); axes[1].set_title("Grad-CAM")
    axes[2].imshow(overlay);     axes[2].set_title("Overlay")
    for ax in axes: ax.axis("off")
    plt.tight_layout()

    if save_path:
        fig.savefig(save_path, dpi=150, bbox_inches="tight")
        print(f"Grad-CAM saved to: {save_path}")
    plt.show()
    plt.close()

