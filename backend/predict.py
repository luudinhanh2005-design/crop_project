"""
predict.py
==========
Dự đoán loại cây từ ảnh qua command line.

Cách dùng:
    python predict.py --image leaf.jpg
    python predict.py --image leaf.jpg --tta            # dùng TTA cho kết quả chính xác hơn
    python predict.py --folder data/test/rice           # dự đoán cả thư mục
    python predict.py --image leaf.jpg --gradcam        # xem Grad-CAM heatmap
    python predict.py --image leaf.jpg --model models/my_model.h5
"""

import argparse
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from config import CLASSES, CLASS_INFO, BEST_MODEL_PATH, MODEL_DIR
from utils.model         import load_model
from utils.predict_utils import predict_single, predict_batch, preprocess_image
from utils.augmentation  import TTA


# ── Hiển thị kết quả ─────────────────────────────────────
def display_result(image_path: str, result: dict, save=True):
    """In kết quả ra terminal và lưu hình minh hoạ."""
    info     = CLASS_INFO[result["class"]]
    conf_pct = result["confidence"] * 100

    print(f"\n{'─'*50}")
    print(f"  Ảnh      : {Path(image_path).name}")
    print(f"  Kết quả  : {info['emoji']} {result['name_vi']} ({result['class']})")
    print(f"  Tin cậy  : {conf_pct:.1f}%")
    print(f"\n  Top-3:")
    for r in result["top3"]:
        bar = "█" * int(r["prob"] * 30)
        print(f"  {r['rank']}. {r['emoji']} {r['name_vi']:<12} {r['prob']*100:5.1f}%  {bar}")
    print(f"{'─'*50}")

    # Lưu hình
    if save:
        _save_result_figure(image_path, result)


def _save_result_figure(image_path, result):
    img  = Image.open(image_path).convert("RGB")
    info = CLASS_INFO[result["class"]]

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    fig.suptitle("Kết quả nhận diện cây lương thực", fontsize=13, fontweight="bold")

    # Ảnh gốc
    axes[0].imshow(img)
    axes[0].set_title(
        f"{info['emoji']} {result['name_vi']}  ({result['confidence']*100:.1f}%)",
        fontsize=12, color="#1565C0", fontweight="bold",
    )
    axes[0].axis("off")

    # Biểu đồ top-3
    names  = [f"{r['emoji']} {r['name_vi']}" for r in result["top3"]]
    probs  = [r["prob"] * 100 for r in result["top3"]]
    colors = ["#1976D2", "#42A5F5", "#90CAF9"]
    bars   = axes[1].barh(names[::-1], probs[::-1], color=colors[::-1], height=0.5)
    for bar, p in zip(bars, probs[::-1]):
        axes[1].text(
            bar.get_width() + 0.5, bar.get_y() + bar.get_height() / 2,
            f"{p:.1f}%", va="center", fontsize=10,
        )
    axes[1].set_xlim(0, 115)
    axes[1].set_xlabel("Xác suất (%)")
    axes[1].set_title("Top-3 dự đoán")
    axes[1].spines[["top", "right"]].set_visible(False)

    plt.tight_layout()
    out = MODEL_DIR / f"predict_{Path(image_path).stem}.png"
    fig.savefig(out, dpi=150, bbox_inches="tight")
    print(f"  ✅ Lưu hình → {out}")
    plt.close()


# ── CLI ───────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Nhận diện cây lương thực từ ảnh",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--image",  help="Đường dẫn ảnh đơn lẻ")
    group.add_argument("--folder", help="Thư mục ảnh cần dự đoán hàng loạt")

    parser.add_argument("--model",   default=str(BEST_MODEL_PATH), help="Đường dẫn file model .h5")
    parser.add_argument("--tta",     action="store_true", help="Dùng Test Time Augmentation")
    parser.add_argument("--gradcam", action="store_true", help="Tạo Grad-CAM heatmap")
    parser.add_argument("--no-save", action="store_true", help="Không lưu hình kết quả")

    args = parser.parse_args()

    # Tải model
    model = load_model(args.model)

    if args.image:
        if args.tta:
            print("🔬 Dùng TTA (Test Time Augmentation)...")
            tta_predictor = TTA(model, n_augments=10)
            probs  = tta_predictor.predict(args.image)
            top3   = np.argsort(probs)[::-1][:3]
            result = {
                "class":      CLASSES[top3[0]],
                "name_vi":    CLASS_INFO[CLASSES[top3[0]]]["vi"],
                "confidence": float(probs[top3[0]]),
                "top3": [{"rank": i+1, "class": CLASSES[idx],
                           "name_vi": CLASS_INFO[CLASSES[idx]]["vi"],
                           "emoji":   CLASS_INFO[CLASSES[idx]]["emoji"],
                           "prob":    float(probs[idx])} for i, idx in enumerate(top3)],
                "all": {CLASSES[i]: float(probs[i]) for i in range(len(CLASSES))},
            }
        else:
            result = predict_single(args.image, model)

        display_result(args.image, result, save=not args.no_save)

        if args.gradcam:
            from utils.evaluate import visualize_gradcam
            pred_idx = CLASSES.index(result["class"])
            out = MODEL_DIR / f"gradcam_{Path(args.image).stem}.png"
            visualize_gradcam(model, args.image, pred_idx, save_path=out)

    elif args.folder:
        predict_batch(args.folder, model, verbose=True)


if __name__ == "__main__":
    main()
