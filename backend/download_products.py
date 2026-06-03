<<<<<<< HEAD
"""
Tải thêm ảnh SẢN PHẨM THU HOẠCH (củ, hạt, quả) cho tất cả các lớp.
Khắc phục vấn đề: mô hình chỉ biết nhận cây trồng trên đồng,
không biết nhận sản phẩm thu hoạch.
"""
import re
import requests
from pathlib import Path

RAW_DIR = Path("d:/crop_project/crop_project/crop_project/data/raw")

# Ảnh sản phẩm thu hoạch (củ, hạt, quả) + ảnh lá cận cảnh
PRODUCT_QUERIES = {
    "rice": [
        "rice grains close up", "hạt gạo", "rice seeds harvest",
        "rice paddy harvest", "lúa gạo hạt", "thóc lúa"
    ],
    "corn": [
        "corn cob harvest", "bắp ngô", "corn kernels close up",
        "trái bắp ngô", "corn ears harvest", "ngô bắp thu hoạch"
    ],
    "wheat": [
        "wheat grains close up", "hạt lúa mì", "wheat ears harvest",
        "wheat seeds", "bông lúa mì", "wheat kernel"
    ],
    "soybean": [
        "soybean seeds close up", "hạt đậu nành", "soybean pods harvest",
        "đậu tương hạt", "soybeans dried beans", "soybean grain"
    ],
    "sugarcane": [
        "sugarcane stalks harvest", "cây mía cắt", "sugarcane juice",
        "thân mía thu hoạch", "sugar cane cut", "mía cây thân"
    ],
    "sweet_potato": [
        "sweet potato tubers", "củ khoai lang", "sweet potato harvest",
        "khoai lang tím", "sweet potato orange", "khoai lang nướng"
    ],
    "cassava": [
        "cassava root tuber", "củ sắn", "cassava harvest",
        "khoai mì củ", "tapioca root", "sắn củ thu hoạch"
    ],
    "potato": [
        "potatoes tubers harvest", "củ khoai tây", "potato harvest pile",
        "khoai tây Đà Lạt", "raw potatoes", "khoai tây củ tươi"
    ],
}

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

TARGET_PER_CLASS = 100  # Tải thêm 100 ảnh sản phẩm

for cls, queries in PRODUCT_QUERIES.items():
    target_dir = RAW_DIR / cls
    target_dir.mkdir(parents=True, exist_ok=True)

    existing = len(list(target_dir.glob("*")))
    print(f"\n{'='*50}")
    print(f"[{cls}] Hiện có {existing} ảnh, tải thêm {TARGET_PER_CLASS} ảnh sản phẩm")
    print(f"{'='*50}")

    count = 0
    for q in queries:
        if count >= TARGET_PER_CLASS:
            break
        url = f"https://www.bing.com/images/search?q={q.replace(' ', '+')}&count=150"
        print(f"  Tìm: {q}")
        try:
            html = requests.get(url, headers=headers, timeout=10).text
            links = re.findall(r'murl&quot;:&quot;(http[^&]+?)&quot;', html)
            
            for link in set(links):
                if count >= TARGET_PER_CLASS:
                    break
                try:
                    if link.lower().endswith((".jpg", ".png", ".jpeg")):
                        resp = requests.get(link, timeout=5, headers=headers)
                        if resp.status_code == 200 and len(resp.content) > 5000:
                            count += 1
                            ext = link.split('.')[-1][:3]
                            file_path = target_dir / f"{cls}_product_{existing + count}.{ext}"
                            with open(file_path, "wb") as f:
                                f.write(resp.content)
                            print(f"    [{count}/{TARGET_PER_CLASS}] {file_path.name}")
                except Exception:
                    pass
        except Exception as e:
            print(f"  Lỗi: {e}")

    print(f"  => Tổng tải được: {count}")

print("\n✅ Hoàn tất tải ảnh sản phẩm thu hoạch!")
=======
"""
Tải thêm ảnh SẢN PHẨM THU HOẠCH (củ, hạt, quả) cho tất cả các lớp.
Khắc phục vấn đề: mô hình chỉ biết nhận cây trồng trên đồng,
không biết nhận sản phẩm thu hoạch.
"""
import re
import requests
from pathlib import Path

RAW_DIR = Path("d:/crop_project/crop_project/crop_project/data/raw")

# Ảnh sản phẩm thu hoạch (củ, hạt, quả) + ảnh lá cận cảnh
PRODUCT_QUERIES = {
    "rice": [
        "rice grains close up", "hạt gạo", "rice seeds harvest",
        "rice paddy harvest", "lúa gạo hạt", "thóc lúa"
    ],
    "corn": [
        "corn cob harvest", "bắp ngô", "corn kernels close up",
        "trái bắp ngô", "corn ears harvest", "ngô bắp thu hoạch"
    ],
    "wheat": [
        "wheat grains close up", "hạt lúa mì", "wheat ears harvest",
        "wheat seeds", "bông lúa mì", "wheat kernel"
    ],
    "soybean": [
        "soybean seeds close up", "hạt đậu nành", "soybean pods harvest",
        "đậu tương hạt", "soybeans dried beans", "soybean grain"
    ],
    "sugarcane": [
        "sugarcane stalks harvest", "cây mía cắt", "sugarcane juice",
        "thân mía thu hoạch", "sugar cane cut", "mía cây thân"
    ],
    "sweet_potato": [
        "sweet potato tubers", "củ khoai lang", "sweet potato harvest",
        "khoai lang tím", "sweet potato orange", "khoai lang nướng"
    ],
    "cassava": [
        "cassava root tuber", "củ sắn", "cassava harvest",
        "khoai mì củ", "tapioca root", "sắn củ thu hoạch"
    ],
    "potato": [
        "potatoes tubers harvest", "củ khoai tây", "potato harvest pile",
        "khoai tây Đà Lạt", "raw potatoes", "khoai tây củ tươi"
    ],
}

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

TARGET_PER_CLASS = 100  # Tải thêm 100 ảnh sản phẩm

for cls, queries in PRODUCT_QUERIES.items():
    target_dir = RAW_DIR / cls
    target_dir.mkdir(parents=True, exist_ok=True)

    existing = len(list(target_dir.glob("*")))
    print(f"\n{'='*50}")
    print(f"[{cls}] Hiện có {existing} ảnh, tải thêm {TARGET_PER_CLASS} ảnh sản phẩm")
    print(f"{'='*50}")

    count = 0
    for q in queries:
        if count >= TARGET_PER_CLASS:
            break
        url = f"https://www.bing.com/images/search?q={q.replace(' ', '+')}&count=150"
        print(f"  Tìm: {q}")
        try:
            html = requests.get(url, headers=headers, timeout=10).text
            links = re.findall(r'murl&quot;:&quot;(http[^&]+?)&quot;', html)
            
            for link in set(links):
                if count >= TARGET_PER_CLASS:
                    break
                try:
                    if link.lower().endswith((".jpg", ".png", ".jpeg")):
                        resp = requests.get(link, timeout=5, headers=headers)
                        if resp.status_code == 200 and len(resp.content) > 5000:
                            count += 1
                            ext = link.split('.')[-1][:3]
                            file_path = target_dir / f"{cls}_product_{existing + count}.{ext}"
                            with open(file_path, "wb") as f:
                                f.write(resp.content)
                            print(f"    [{count}/{TARGET_PER_CLASS}] {file_path.name}")
                except Exception:
                    pass
        except Exception as e:
            print(f"  Lỗi: {e}")

    print(f"  => Tổng tải được: {count}")

print("\n✅ Hoàn tất tải ảnh sản phẩm thu hoạch!")
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
