"""
setup.py
========
Script cài đặt dự án một lần duy nhất.
Chạy lệnh này đầu tiên sau khi clone/giải nén project.

Cách dùng:
    python setup.py
"""

import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent


def run(cmd, desc=""):
    print(f"\n▶ {desc or cmd}")
    result = subprocess.run(cmd, shell=True)
    return result.returncode == 0


def check_python():
    v = sys.version_info
    if v.major < 3 or (v.major == 3 and v.minor < 8):
        print(f"❌ Cần Python >= 3.8. Hiện tại: {v.major}.{v.minor}")
        sys.exit(1)
    print(f"✅ Python {v.major}.{v.minor}.{v.micro}")


def create_dirs():
    dirs = [
        "data/raw", "data/train", "data/val", "data/test",
        "models", "logs", "notebooks",
    ]
    for d in dirs:
        Path(d).mkdir(parents=True, exist_ok=True)
    print("✅ Đã tạo cấu trúc thư mục")


def install_deps():
    ok = run("pip install -r requirements.txt", "Cài thư viện từ requirements.txt")
    if not ok:
        print("⚠️  Thử cài từng thư viện riêng:")
        for pkg in ["tensorflow", "streamlit", "scikit-learn",
                    "matplotlib", "seaborn", "Pillow", "opencv-python",
                    "tqdm", "pandas", "kaggle"]:
            run(f"pip install {pkg}", f"  pip install {pkg}")


def verify():
    print("\n🔍 Kiểm tra cài đặt...")
    checks = [
        ("import tensorflow as tf; print(f'TensorFlow {tf.__version__}')", "TensorFlow"),
        ("import streamlit; print(f'Streamlit {streamlit.__version__}')", "Streamlit"),
        ("import sklearn; print(f'scikit-learn {sklearn.__version__}')", "scikit-learn"),
        ("import cv2; print(f'OpenCV {cv2.__version__}')", "OpenCV"),
    ]
    all_ok = True
    for cmd, name in checks:
        r = subprocess.run(f'python -c "{cmd}"', shell=True, capture_output=True, text=True)
        if r.returncode == 0:
            print(f"  ✅ {r.stdout.strip()}")
        else:
            print(f"  ❌ {name}: {r.stderr.strip()[:60]}")
            all_ok = False
    return all_ok


def main():
    print("=" * 60)
    print("  Cài đặt Dự án Nhận Diện Cây Lương Thực")
    print("=" * 60)

    check_python()
    create_dirs()
    install_deps()
    ok = verify()

    print("\n" + "=" * 60)
    if ok:
        print("  ✅ Cài đặt hoàn tất!")
        print("\n  Bước tiếp theo:")
        print("  1. Đặt ảnh vào data/raw/<tên_cây>/")
        print("     hoặc chạy: python utils/dataset.py  (tải từ Kaggle)")
        print("  2. Huấn luyện: python train.py")
        print("  3. Demo web:   streamlit run app.py")
    else:
        print("  ⚠️  Một số thư viện chưa cài được.")
        print("  Thử chạy lại hoặc cài thủ công từng gói.")
    print("=" * 60)


if __name__ == "__main__":
    main()
