<<<<<<< HEAD
"""
evaluate.py
===========
Đánh giá mô hình đã train trên tập test.

Cách dùng:
    python evaluate.py
    python evaluate.py --model models/my_model.h5
    python evaluate.py --gradcam --image data/test/rice/leaf1.jpg
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from config import BEST_MODEL_PATH, MODEL_DIR
from utils.model    import load_model
from utils.dataset  import create_generators
from utils.evaluate import evaluate_model, plot_confusion_matrix, plot_history
from config         import HISTORY_PATH


def main():
    parser = argparse.ArgumentParser(description="Đánh giá mô hình nhận diện cây lương thực")
    parser.add_argument("--model",   default=str(BEST_MODEL_PATH))
    parser.add_argument("--gradcam", action="store_true", help="Tạo Grad-CAM")
    parser.add_argument("--image",   help="Ảnh để Grad-CAM (dùng với --gradcam)")
    args = parser.parse_args()

    model = load_model(args.model)

    print("\n📂 Tải tập test...")
    _, _, test_gen = create_generators(augment=False)

    print("\n🔍 Đánh giá mô hình...")
    result = evaluate_model(model, test_gen, verbose=True)

    plot_confusion_matrix(result["y_true"], result["y_pred"], save=True)

    if HISTORY_PATH.exists():
        plot_history(HISTORY_PATH, save=True)

    if args.gradcam and args.image:
        from config import CLASSES
        from utils.evaluate import visualize_gradcam
        from utils.predict_utils import predict_single
        res  = predict_single(args.image, model)
        idx  = CLASSES.index(res["class"])
        out  = MODEL_DIR / f"gradcam_{Path(args.image).stem}.png"
        visualize_gradcam(model, args.image, idx, save_path=out)

    print(f"\n✅ Đánh giá hoàn tất!")
    print(f"   Accuracy: {result['accuracy']*100:.2f}%")
    print(f"   F1 Score: {result['f1']*100:.2f}%")


if __name__ == "__main__":
    main()
=======
"""
evaluate.py
===========
Đánh giá mô hình đã train trên tập test.

Cách dùng:
    python evaluate.py
    python evaluate.py --model models/my_model.h5
    python evaluate.py --gradcam --image data/test/rice/leaf1.jpg
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from config import BEST_MODEL_PATH, MODEL_DIR
from utils.model    import load_model
from utils.dataset  import create_generators
from utils.evaluate import evaluate_model, plot_confusion_matrix, plot_history
from config         import HISTORY_PATH


def main():
    parser = argparse.ArgumentParser(description="Đánh giá mô hình nhận diện cây lương thực")
    parser.add_argument("--model",   default=str(BEST_MODEL_PATH))
    parser.add_argument("--gradcam", action="store_true", help="Tạo Grad-CAM")
    parser.add_argument("--image",   help="Ảnh để Grad-CAM (dùng với --gradcam)")
    args = parser.parse_args()

    model = load_model(args.model)

    print("\n📂 Tải tập test...")
    _, _, test_gen = create_generators(augment=False)

    print("\n🔍 Đánh giá mô hình...")
    result = evaluate_model(model, test_gen, verbose=True)

    plot_confusion_matrix(result["y_true"], result["y_pred"], save=True)

    if HISTORY_PATH.exists():
        plot_history(HISTORY_PATH, save=True)

    if args.gradcam and args.image:
        from config import CLASSES
        from utils.evaluate import visualize_gradcam
        from utils.predict_utils import predict_single
        res  = predict_single(args.image, model)
        idx  = CLASSES.index(res["class"])
        out  = MODEL_DIR / f"gradcam_{Path(args.image).stem}.png"
        visualize_gradcam(model, args.image, idx, save_path=out)

    print(f"\n✅ Đánh giá hoàn tất!")
    print(f"   Accuracy: {result['accuracy']*100:.2f}%")
    print(f"   F1 Score: {result['f1']*100:.2f}%")


if __name__ == "__main__":
    main()
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
