<<<<<<< HEAD
import os
import requests
from bs4 import BeautifulSoup
import json
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Cấu hình
BASE_DIR = Path(__file__).parent.parent
DATA_RAW = BASE_DIR / "data" / "raw"
TARGET_ADDITIONAL = 1000 # Mục tiêu 1000 ảnh mỗi loại để đạt độ chính xác tối đa (>90%)
TIMEOUT = 12
MAX_WORKERS = 10 

CLASSES = [
    ("rice_leaf", ["paddy rice leaf field", "rice plant leaf disease photo", "la lua ngoai dong"]),
    ("rice_stalk", ["rice stem field view", "paddy stalk close up", "than cay lua"]),
    ("rice_product", ["ripe rice panicle field", "paddy harvesting", "bong lua chin"]),
    
    ("corn_leaf", ["maize leaf field context", "corn plant leaves photo", "la ngo xanh"]),
    ("corn_stalk", ["corn stalk field view", "maize stem agriculture", "than cay ngo"]),
    ("corn_product", ["corn cob on plant", "maize ear harvesting", "bap ngo tren cay"]),
    
    ("wheat_leaf", ["wheat leaf field photo", "wheat plant leaves", "la lua mi"]),
    ("wheat_stalk", ["wheat stalk field", "wheat stem closeup", "than cay lua mi"]),
    ("wheat_product", ["ripe wheat ear field", "wheat harvesting", "bong lua mi"]),
    
    ("soybean_leaf", ["soybean leaf field", "soy plant leaves photo", "la dau nanh"]),
    ("soybean_stalk", ["soybean stalk field view", "soy stem", "than cay dau nanh"]),
    ("soybean_product", ["soybean pods on plant", "soy bean harvesting", "qua dau nanh"]),
    
    ("sugarcane_leaf", ["sugarcane leaf field view", "sugar cane leaves photo", "la mia xanh"]),
    ("sugarcane_stalk", ["sugarcane stalk field context", "sugar cane stem mature", "than cay mia"]),
    ("sugarcane_product", ["harvested sugarcane stalks", "sugar cane pile", "khuc mia"]),
    
    ("rice_product", ["bông lúa thực tế", "hạt lúa chín ngoài đồng", "rice paddy ear close up", "rice grains on plant"]),
    ("corn_stalk", ["thân cây ngô khô", "corn stalk field view", "corn plant stem", "thân cây bắp ngoài đồng"]),
    ("sweet_potato_product", ["củ khoai lang thực tế", "sweet potato tuber ground", "thu hoạch khoai lang", "raw sweet potato"]),
    ("soybean_product", ["quả đậu nành trên cây", "soybean pods on plant", "hạt đậu nành thực tế"]),
    ("sugarcane_stalk", ["thân cây mía ngoài đồng", "sugarcane stalk field", "chặt mía"]),
    
    ("cassava_leaf", ["cassava leaf field view", "manioc leaves photo", "la san xanh"]),
    ("cassava_stalk", ["cassava stalk field", "tapioca stem", "than cay san"]),
    ("cassava_product", ["cassava tuber harvesting", "yuca root ground", "cu san tuoi"]),
    
    ("potato_leaf", ["potato leaf field view", "potato plant leaves photo", "la khoai tay"]),
    ("potato_stalk", ["potato plant stem field", "potato stalk", "than cay khoai tay"]),
    ("potato_product", ["potato tuber harvesting", "raw potatoes ground", "cu khoai tay"]),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def get_image_urls(query, limit):
    urls = []
    first = 1
    while len(urls) < limit:
        search_url = f"https://www.bing.com/images/search?q={query.replace(' ', '+')}&first={first}"
        try:
            response = requests.get(search_url, headers=HEADERS, timeout=TIMEOUT)
            if response.status_code != 200: break
            
            soup = BeautifulSoup(response.text, 'html.parser')
            elements = soup.find_all("a", {"class": "iusc"})
            
            new_urls = []
            for el in elements:
                try:
                    m = json.loads(el.get("m", "{}"))
                    murl = m.get("murl")
                    if murl and murl not in urls:
                        new_urls.append(murl)
                except: continue
            
            if not new_urls: break
            urls.extend(new_urls)
            first += len(elements)
            if len(elements) < 10: break
        except: break
    return urls[:limit]

def download_image(url, save_path):
    try:
        response = requests.get(url, headers=HEADERS, timeout=10, stream=True)
        if response.status_code == 200:
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            return True
    except: pass
    return False

def process_field_view(class_name, queries):
    target_dir = DATA_RAW / class_name
    target_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n--- {class_name}: Tai them {TARGET_ADDITIONAL} anh FIELD-VIEW ---")
    all_urls = []
    for q in queries:
        all_urls.extend(get_image_urls(q, 100))
    
    all_urls = list(set(all_urls))[:TARGET_ADDITIONAL]
    
    success = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = []
        for i, url in enumerate(all_urls):
            ext = url.split('.')[-1].split('?')[0].lower()
            if ext not in ['jpg', 'jpeg', 'png']: ext = 'jpg'
            save_path = target_dir / f"fv_{i}_{int(time.time())}.{ext}"
            futures.append(executor.submit(download_image, url, save_path))
            
        for future in as_completed(futures):
            if future.result(): success += 1
                
    print(f"   -> Thanh cong: {success} anh thuc te.")

if __name__ == "__main__":
    print("=== BAT DAU TAI ANH FIELD-VIEW (PHASE 2) ===")
    for class_name, queries in CLASSES:
        process_field_view(class_name, queries)
    print("\n=== HOAN TAT TAI ANH BO SUNG ===")
=======
import os
import requests
from bs4 import BeautifulSoup
import json
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Cấu hình
BASE_DIR = Path(__file__).parent.parent
DATA_RAW = BASE_DIR / "data" / "raw"
TARGET_ADDITIONAL = 1000 # Mục tiêu 1000 ảnh mỗi loại để đạt độ chính xác tối đa (>90%)
TIMEOUT = 12
MAX_WORKERS = 10 

CLASSES = [
    ("rice_leaf", ["paddy rice leaf field", "rice plant leaf disease photo", "la lua ngoai dong"]),
    ("rice_stalk", ["rice stem field view", "paddy stalk close up", "than cay lua"]),
    ("rice_product", ["ripe rice panicle field", "paddy harvesting", "bong lua chin"]),
    
    ("corn_leaf", ["maize leaf field context", "corn plant leaves photo", "la ngo xanh"]),
    ("corn_stalk", ["corn stalk field view", "maize stem agriculture", "than cay ngo"]),
    ("corn_product", ["corn cob on plant", "maize ear harvesting", "bap ngo tren cay"]),
    
    ("wheat_leaf", ["wheat leaf field photo", "wheat plant leaves", "la lua mi"]),
    ("wheat_stalk", ["wheat stalk field", "wheat stem closeup", "than cay lua mi"]),
    ("wheat_product", ["ripe wheat ear field", "wheat harvesting", "bong lua mi"]),
    
    ("soybean_leaf", ["soybean leaf field", "soy plant leaves photo", "la dau nanh"]),
    ("soybean_stalk", ["soybean stalk field view", "soy stem", "than cay dau nanh"]),
    ("soybean_product", ["soybean pods on plant", "soy bean harvesting", "qua dau nanh"]),
    
    ("sugarcane_leaf", ["sugarcane leaf field view", "sugar cane leaves photo", "la mia xanh"]),
    ("sugarcane_stalk", ["sugarcane stalk field context", "sugar cane stem mature", "than cay mia"]),
    ("sugarcane_product", ["harvested sugarcane stalks", "sugar cane pile", "khuc mia"]),
    
    ("rice_product", ["bông lúa thực tế", "hạt lúa chín ngoài đồng", "rice paddy ear close up", "rice grains on plant"]),
    ("corn_stalk", ["thân cây ngô khô", "corn stalk field view", "corn plant stem", "thân cây bắp ngoài đồng"]),
    ("sweet_potato_product", ["củ khoai lang thực tế", "sweet potato tuber ground", "thu hoạch khoai lang", "raw sweet potato"]),
    ("soybean_product", ["quả đậu nành trên cây", "soybean pods on plant", "hạt đậu nành thực tế"]),
    ("sugarcane_stalk", ["thân cây mía ngoài đồng", "sugarcane stalk field", "chặt mía"]),
    
    ("cassava_leaf", ["cassava leaf field view", "manioc leaves photo", "la san xanh"]),
    ("cassava_stalk", ["cassava stalk field", "tapioca stem", "than cay san"]),
    ("cassava_product", ["cassava tuber harvesting", "yuca root ground", "cu san tuoi"]),
    
    ("potato_leaf", ["potato leaf field view", "potato plant leaves photo", "la khoai tay"]),
    ("potato_stalk", ["potato plant stem field", "potato stalk", "than cay khoai tay"]),
    ("potato_product", ["potato tuber harvesting", "raw potatoes ground", "cu khoai tay"]),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def get_image_urls(query, limit):
    urls = []
    first = 1
    while len(urls) < limit:
        search_url = f"https://www.bing.com/images/search?q={query.replace(' ', '+')}&first={first}"
        try:
            response = requests.get(search_url, headers=HEADERS, timeout=TIMEOUT)
            if response.status_code != 200: break
            
            soup = BeautifulSoup(response.text, 'html.parser')
            elements = soup.find_all("a", {"class": "iusc"})
            
            new_urls = []
            for el in elements:
                try:
                    m = json.loads(el.get("m", "{}"))
                    murl = m.get("murl")
                    if murl and murl not in urls:
                        new_urls.append(murl)
                except: continue
            
            if not new_urls: break
            urls.extend(new_urls)
            first += len(elements)
            if len(elements) < 10: break
        except: break
    return urls[:limit]

def download_image(url, save_path):
    try:
        response = requests.get(url, headers=HEADERS, timeout=10, stream=True)
        if response.status_code == 200:
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            return True
    except: pass
    return False

def process_field_view(class_name, queries):
    target_dir = DATA_RAW / class_name
    target_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n--- {class_name}: Tai them {TARGET_ADDITIONAL} anh FIELD-VIEW ---")
    all_urls = []
    for q in queries:
        all_urls.extend(get_image_urls(q, 100))
    
    all_urls = list(set(all_urls))[:TARGET_ADDITIONAL]
    
    success = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = []
        for i, url in enumerate(all_urls):
            ext = url.split('.')[-1].split('?')[0].lower()
            if ext not in ['jpg', 'jpeg', 'png']: ext = 'jpg'
            save_path = target_dir / f"fv_{i}_{int(time.time())}.{ext}"
            futures.append(executor.submit(download_image, url, save_path))
            
        for future in as_completed(futures):
            if future.result(): success += 1
                
    print(f"   -> Thanh cong: {success} anh thuc te.")

if __name__ == "__main__":
    print("=== BAT DAU TAI ANH FIELD-VIEW (PHASE 2) ===")
    for class_name, queries in CLASSES:
        process_field_view(class_name, queries)
    print("\n=== HOAN TAT TAI ANH BO SUNG ===")
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
