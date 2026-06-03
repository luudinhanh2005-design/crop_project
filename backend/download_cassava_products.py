<<<<<<< HEAD
"""
Tải thêm ảnh CỦ SẮN / BỘT SẮN - sản phẩm thu hoạch.
Cần 300+ ảnh để cân bằng với ảnh lá sắn.
"""
import re
import requests
from pathlib import Path

RAW_DIR = Path("d:/crop_project/crop_project/crop_project/data/raw/cassava")
RAW_DIR.mkdir(parents=True, exist_ok=True)

QUERIES = [
    "cassava root tuber", "cassava tuber harvest", "củ sắn tươi",
    "cassava root peeled", "khoai mì củ", "tapioca root fresh",
    "sắn củ gọt vỏ", "cassava root close up", "manihot esculenta root",
    "raw cassava tuber", "cassava flour powder", "bột sắn khoai mì",
    "tapioca starch", "cassava chips", "sắn lát phơi khô",
    "cassava root sliced", "fresh cassava market", "sắn tươi chợ",
    "cassava root pile harvest", "boiled cassava", "sắn luộc",
    "fried cassava", "sắn chiên", "cassava cake", "bánh sắn",
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

existing = len(list(RAW_DIR.glob("*")))
TARGET = 400
count = 0

print(f"Hiện có: {existing} ảnh sắn. Cần tải thêm {TARGET} ảnh CỦ SẮN...")

for q in QUERIES:
    if count >= TARGET:
        break
    url = f"https://www.bing.com/images/search?q={q.replace(' ', '+')}&count=150"
    print(f"  Tìm: {q}")
    try:
        html = requests.get(url, headers=headers, timeout=10).text
        links = re.findall(r'murl&quot;:&quot;(http[^&]+?)&quot;', html)
        for link in set(links):
            if count >= TARGET:
                break
            try:
                if link.lower().endswith((".jpg", ".png", ".jpeg")):
                    resp = requests.get(link, timeout=5, headers=headers)
                    if resp.status_code == 200 and len(resp.content) > 5000:
                        count += 1
                        ext = link.split('.')[-1][:3]
                        fp = RAW_DIR / f"cassava_tuber_{existing + count}.{ext}"
                        with open(fp, "wb") as f:
                            f.write(resp.content)
                        print(f"    [{count}/{TARGET}] {fp.name}")
            except Exception:
                pass
    except Exception as e:
        print(f"  Lỗi: {e}")

print(f"\n✅ Đã tải thêm {count} ảnh củ sắn / bột sắn!")
=======
"""
Tải thêm ảnh CỦ SẮN / BỘT SẮN - sản phẩm thu hoạch.
Cần 300+ ảnh để cân bằng với ảnh lá sắn.
"""
import re
import requests
from pathlib import Path

RAW_DIR = Path("d:/crop_project/crop_project/crop_project/data/raw/cassava")
RAW_DIR.mkdir(parents=True, exist_ok=True)

QUERIES = [
    "cassava root tuber", "cassava tuber harvest", "củ sắn tươi",
    "cassava root peeled", "khoai mì củ", "tapioca root fresh",
    "sắn củ gọt vỏ", "cassava root close up", "manihot esculenta root",
    "raw cassava tuber", "cassava flour powder", "bột sắn khoai mì",
    "tapioca starch", "cassava chips", "sắn lát phơi khô",
    "cassava root sliced", "fresh cassava market", "sắn tươi chợ",
    "cassava root pile harvest", "boiled cassava", "sắn luộc",
    "fried cassava", "sắn chiên", "cassava cake", "bánh sắn",
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

existing = len(list(RAW_DIR.glob("*")))
TARGET = 400
count = 0

print(f"Hiện có: {existing} ảnh sắn. Cần tải thêm {TARGET} ảnh CỦ SẮN...")

for q in QUERIES:
    if count >= TARGET:
        break
    url = f"https://www.bing.com/images/search?q={q.replace(' ', '+')}&count=150"
    print(f"  Tìm: {q}")
    try:
        html = requests.get(url, headers=headers, timeout=10).text
        links = re.findall(r'murl&quot;:&quot;(http[^&]+?)&quot;', html)
        for link in set(links):
            if count >= TARGET:
                break
            try:
                if link.lower().endswith((".jpg", ".png", ".jpeg")):
                    resp = requests.get(link, timeout=5, headers=headers)
                    if resp.status_code == 200 and len(resp.content) > 5000:
                        count += 1
                        ext = link.split('.')[-1][:3]
                        fp = RAW_DIR / f"cassava_tuber_{existing + count}.{ext}"
                        with open(fp, "wb") as f:
                            f.write(resp.content)
                        print(f"    [{count}/{TARGET}] {fp.name}")
            except Exception:
                pass
    except Exception as e:
        print(f"  Lỗi: {e}")

print(f"\n✅ Đã tải thêm {count} ảnh củ sắn / bột sắn!")
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
