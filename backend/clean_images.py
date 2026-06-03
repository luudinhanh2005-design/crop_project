import os
from pathlib import Path
from PIL import Image
from tqdm import tqdm

DATA_RAW = Path(r"d:\crop_project\crop_project\crop_project\data\raw")

def clean_corrupted_images():
    print("--- Bat dau quet va xoa anh loi trong data/raw ---")
    found_corrupted = 0
    total_scanned = 0
    
    # Duyet qua 24 thu muc
    for folder in DATA_RAW.iterdir():
        if not folder.is_dir():
            continue
            
        print(f"Scanning: {folder.name}...")
        for img_path in folder.glob("*.*"):
            total_scanned += 1
            try:
                with Image.open(img_path) as img:
                    img.verify()
                with Image.open(img_path) as img:
                    img.load()
            except Exception:
                try:
                    img_path.unlink()
                    found_corrupted += 1
                except:
                    pass
                    
    print(f"\nCompleted cleanup!")
    print(f"Total scanned: {total_scanned}")
    print(f"Corrupted deleted: {found_corrupted}")

if __name__ == "__main__":
    clean_corrupted_images()
