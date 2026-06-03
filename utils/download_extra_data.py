<<<<<<< HEAD
import subprocess
from pathlib import Path

# Thư mục chứa dữ liệu thô
RAW_DIR = Path("data/raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)

# Sử dụng HUB DATASET (104.000 ảnh) để đảm bảo số lượng 1000+ mỗi loại
EXTRA_DATASETS = {
    "hub":          "omrathod/plants-and-crops-image-dataset", # 139 classes, ~250 per class
    "sweet_potato": "marquis03/sweet-potato-disease",          # ~2500 images
    "soybean":      "pavanraj159/soybean-leaf-disease-dataset",# ~5000 images
    "rice":         "vbookshelf/rice-leaf-diseases",           # ~3000 images
    "wheat":        "mhassansaboor/wheat-leaf-disease-dataset" # ~9000 images
}

def download_and_extract(cls, dataset_id):
    print(f"Downloading data for: {cls.upper()} ({dataset_id})...")
    # Tải về bằng Kaggle API
    # Dùng --unzip để tự động giải nén
    # Dùng -p để chỉ định thư mục (tạo thư mục riêng cho từng dataset để tránh xung đột)
    out_dir = RAW_DIR / f"extra_{cls}"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    cmd = [
        "venv\\Scripts\\kaggle.exe", "datasets", "download", 
        "-d", dataset_id, 
        "-p", str(out_dir), 
        "--unzip"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print(f"Finished downloading: {cls}")
    except subprocess.CalledProcessError as e:
        print(f"Error downloading {cls}: {e}")

if __name__ == "__main__":
    for cls, ds_id in EXTRA_DATASETS.items():
        download_and_extract(cls, ds_id)
    print("\nCompleted downloading extra data!")
=======
import subprocess
from pathlib import Path

# Thư mục chứa dữ liệu thô
RAW_DIR = Path("data/raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)

# Sử dụng HUB DATASET (104.000 ảnh) để đảm bảo số lượng 1000+ mỗi loại
EXTRA_DATASETS = {
    "hub":          "omrathod/plants-and-crops-image-dataset", # 139 classes, ~250 per class
    "sweet_potato": "marquis03/sweet-potato-disease",          # ~2500 images
    "soybean":      "pavanraj159/soybean-leaf-disease-dataset",# ~5000 images
    "rice":         "vbookshelf/rice-leaf-diseases",           # ~3000 images
    "wheat":        "mhassansaboor/wheat-leaf-disease-dataset" # ~9000 images
}

def download_and_extract(cls, dataset_id):
    print(f"Downloading data for: {cls.upper()} ({dataset_id})...")
    # Tải về bằng Kaggle API
    # Dùng --unzip để tự động giải nén
    # Dùng -p để chỉ định thư mục (tạo thư mục riêng cho từng dataset để tránh xung đột)
    out_dir = RAW_DIR / f"extra_{cls}"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    cmd = [
        "venv\\Scripts\\kaggle.exe", "datasets", "download", 
        "-d", dataset_id, 
        "-p", str(out_dir), 
        "--unzip"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print(f"Finished downloading: {cls}")
    except subprocess.CalledProcessError as e:
        print(f"Error downloading {cls}: {e}")

if __name__ == "__main__":
    for cls, ds_id in EXTRA_DATASETS.items():
        download_and_extract(cls, ds_id)
    print("\nCompleted downloading extra data!")
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
