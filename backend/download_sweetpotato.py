import os
import re
import requests
from pathlib import Path

RAW_DIR = Path("d:/crop_project/crop_project/crop_project/data/raw/sweet_potato")
RAW_DIR.mkdir(parents=True, exist_ok=True)

queries = ["sweet potato plant field", "khoai lang mọc trên đồng", "sweet potato farming"]
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

count = 0
max_images = 150

for q in queries:
    if count >= max_images:
        break
    url = f"https://www.bing.com/images/search?q={q.replace(' ', '+')}"
    print(f"Searching: {url}")
    try:
        html = requests.get(url, headers=headers).text
        # Tìm links ảnh high-res của Bing (murl)
        links = re.findall(r'murl&quot;:&quot;(http[^&]+?)&quot;', html)
        
        for link in set(links):
            if count >= max_images:
                break
            try:
                if link.lower().endswith((".jpg", ".png", ".jpeg")):
                    resp = requests.get(link, timeout=5, headers=headers)
                    if resp.status_code == 200:
                        count += 1
                        ext = link.split('.')[-1][:3]
                        file_path = RAW_DIR / f"sweet_potato_{count}.{ext}"
                        with open(file_path, "wb") as f:
                            f.write(resp.content)
                        print(f"[{count}] Saved: {file_path.name}")
            except Exception:
                pass
    except Exception as e:
        print(f"Failed query {q}: {e}")

print(f"Total downloaded: {count}")
