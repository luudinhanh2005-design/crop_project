"""
Download thêm ảnh cho tất cả các lớp yếu từ Bing Images.
"""
import os
import re
import requests
from pathlib import Path

RAW_DIR = Path("d:/crop_project/crop_project/crop_project/data/raw")

# Các lớp cần bổ sung ảnh (chỉ tải cho các lớp < 100 ảnh gốc)
DOWNLOAD_TASKS = {
    "rice": [
        "rice paddy field", "rice plant green", "rice crop farming",
        "cánh đồng lúa xanh", "rice seedling", "lúa chín vàng"
    ],
    "corn": [
        "corn field green", "corn plant growing", "corn crop farming",
        "ngô trồng trên đồng", "corn stalks", "maize field"
    ],
    "wheat": [
        "wheat field golden", "wheat plant growing", "wheat crop farming",
        "wheat ears close up", "wheat seedling", "barley wheat field"
    ],
    "soybean": [
        "soybean plant field", "soybean crop farming", "soybean leaves green",
        "đậu nành trồng trên đồng", "soybean pods plant", "soybean seedling"
    ],
    "sugarcane": [
        "sugarcane field", "sugarcane plant growing", "sugarcane farming",
        "mía đường trồng", "sugarcane stalks", "sugar cane plantation"
    ],
}

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

MAX_PER_CLASS = 200

for cls, queries in DOWNLOAD_TASKS.items():
    target_dir = RAW_DIR / cls
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # Đếm ảnh hiện có
    existing = len(list(target_dir.glob("*")))
    needed = MAX_PER_CLASS - existing
    if needed <= 0:
        print(f"[{cls}] Đã có {existing} ảnh, bỏ qua.")
        continue
    
    print(f"\n{'='*50}")
    print(f"[{cls}] Hiện có {existing} ảnh, cần tải thêm {needed}")
    print(f"{'='*50}")
    
    count = 0
    for q in queries:
        if count >= needed:
            break
        url = f"https://www.bing.com/images/search?q={q.replace(' ', '+')}&count=150"
        print(f"  Tìm: {q}")
        try:
            html = requests.get(url, headers=headers).text
            links = re.findall(r'murl&quot;:&quot;(http[^&]+?)&quot;', html)
            
            for link in set(links):
                if count >= needed:
                    break
                try:
                    if link.lower().endswith((".jpg", ".png", ".jpeg")):
                        resp = requests.get(link, timeout=5, headers=headers)
                        if resp.status_code == 200 and len(resp.content) > 5000:
                            count += 1
                            ext = link.split('.')[-1][:3]
                            file_path = target_dir / f"{cls}_dl_{existing + count}.{ext}"
                            with open(file_path, "wb") as f:
                                f.write(resp.content)
                            print(f"    [{count}/{needed}] {file_path.name}")
                except Exception:
                    pass
        except Exception as e:
            print(f"  Lỗi: {e}")
    
    print(f"  => Tổng tải được: {count}")

print("\n✅ Hoàn tất tải ảnh bổ sung!")
