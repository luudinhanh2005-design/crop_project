"""
test_all_classes.py
===================
Kiem tra toan bo 24 lop nhan dien bang cach gui anh test len API.
Lay 3 anh ngau nhien tu moi lop trong data/test/ va gui len /predict.
"""
import os
import random
import requests
from pathlib import Path
from collections import defaultdict

API_URL = "http://localhost:8000/predict"
TEST_DIR = Path("data/test")
SAMPLES_PER_CLASS = 3

CLASSES = [
    "rice_leaf", "rice_stalk", "rice_product",
    "corn_leaf", "corn_stalk", "corn_product",
    "wheat_leaf", "wheat_stalk", "wheat_product",
    "soybean_leaf", "soybean_stalk", "soybean_product",
    "sugarcane_leaf", "sugarcane_stalk", "sugarcane_product",
    "sweet_potato_leaf", "sweet_potato_stalk", "sweet_potato_product",
    "cassava_leaf", "cassava_stalk", "cassava_product",
    "potato_leaf", "potato_stalk", "potato_product",
]

def test_class(class_name):
    class_dir = TEST_DIR / class_name
    if not class_dir.exists():
        return None, f"Thu muc khong ton tai: {class_dir}"

    images = [f for f in class_dir.iterdir() if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
    if not images:
        return None, "Khong co anh nao"

    samples = random.sample(images, min(SAMPLES_PER_CLASS, len(images)))
    results = []

    for img_path in samples:
        try:
            with open(img_path, "rb") as f:
                resp = requests.post(API_URL, files={"file": (img_path.name, f, "image/jpeg")}, timeout=30)
            
            if resp.status_code != 200:
                results.append({
                    "file": img_path.name,
                    "status": "API_ERROR",
                    "detail": f"HTTP {resp.status_code}"
                })
                continue

            data = resp.json()
            predicted = data.get("prediction", "unknown")
            confidence = data.get("probability", 0)
            correct = (predicted == class_name)

            results.append({
                "file": img_path.name,
                "expected": class_name,
                "predicted": predicted,
                "confidence": round(confidence * 100, 1) if confidence <= 1 else round(confidence, 1),
                "correct": correct
            })
        except Exception as e:
            results.append({
                "file": img_path.name,
                "status": "ERROR",
                "detail": str(e)
            })

    return results, None

def main():
    print("=" * 70)
    print("  KIEM TRA TOAN BO 24 LOP NHAN DIEN")
    print("=" * 70)

    total_tests = 0
    total_correct = 0
    total_wrong = 0
    total_errors = 0
    wrong_list = []
    error_list = []
    class_results = {}

    for cls in CLASSES:
        results, err = test_class(cls)
        
        if err:
            print(f"  [{cls:25s}] SKIP - {err}")
            error_list.append({"class": cls, "error": err})
            total_errors += 1
            continue
        
        correct_count = sum(1 for r in results if r.get("correct"))
        wrong_in_class = [r for r in results if r.get("correct") == False]
        api_errors = [r for r in results if r.get("status") in ("API_ERROR", "ERROR")]
        
        total_tests += len(results)
        total_correct += correct_count
        total_wrong += len(wrong_in_class)
        total_errors += len(api_errors)

        status = "OK" if correct_count == len(results) else "SAI"
        icon = "[PASS]" if status == "OK" else "[FAIL]"
        
        print(f"  {icon} {cls:25s} -> Dung: {correct_count}/{len(results)}", end="")
        
        if wrong_in_class:
            for w in wrong_in_class:
                print(f"  | Sai: {w['file'][:20]} -> {w['predicted']} ({w['confidence']}%)", end="")
                wrong_list.append(w)
        
        if api_errors:
            for e in api_errors:
                print(f"  | Loi: {e.get('detail', 'unknown')}", end="")
        
        print()
        class_results[cls] = {"correct": correct_count, "total": len(results)}

    # Tong ket
    print()
    print("=" * 70)
    print("  TONG KET")
    print("=" * 70)
    accuracy = (total_correct / total_tests * 100) if total_tests > 0 else 0
    print(f"  Tong so anh da test  : {total_tests}")
    print(f"  So anh dung          : {total_correct}")
    print(f"  So anh sai           : {total_wrong}")
    print(f"  So loi API/thu muc   : {total_errors}")
    print(f"  Do chinh xac (test)  : {accuracy:.1f}%")
    
    if wrong_list:
        print()
        print("-" * 70)
        print("  CHI TIET CAC ANH BI NHAN DIEN SAI:")
        print("-" * 70)
        for w in wrong_list:
            print(f"    File: {w['file']}")
            print(f"      Ky vong  : {w['expected']}")
            print(f"      Nhan dien: {w['predicted']} ({w['confidence']}%)")
            print()

if __name__ == "__main__":
    main()
