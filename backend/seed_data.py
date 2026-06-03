import os
from supabase import create_client
import random
import datetime

# Supabase Credentials (from app)
SUPABASE_URL = "https://rsjiaxbvlnslmtollozg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzamlheGJ2bG5zbG10b2xsb3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTg1NjcsImV4cCI6MjA5MjQzNDU2N30.vl13Y4ZiVd6p2j2zdIEQbyS0Lk5V0OFiJ0AQLHLxK_c"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Tọa độ các vùng trọng điểm
REGIONS = {
    "Mekong_Delta": {"lat_min": 9.5, "lat_max": 10.8, "lng_min": 104.5, "lng_max": 106.5, "crops": ["rice", "sugarcane", "sweet_potato"]},
    "Central_Highlands": {"lat_min": 11.5, "lat_max": 14.5, "lng_min": 107.5, "lng_max": 108.5, "crops": ["corn", "cassava", "soybean"]},
    "Red_River_Delta": {"lat_min": 20.0, "lat_max": 21.3, "lng_min": 105.5, "lng_max": 106.5, "crops": ["rice", "corn", "potato"]},
}

CROP_DISEASES = {
    "rice": ["rice_brown_spot", "rice_hispa", "rice_leaf_blast", "rice_neck_blast", "rice_healthy"],
    "corn": ["corn_common_rust", "corn_gray_leaf_spot", "corn_northern_leaf_blight", "corn_healthy"],
    "sugarcane": ["sugarcane_bacterial_blight", "sugarcane_red_rot", "sugarcane_rust", "sugarcane_healthy"],
    "cassava": ["cassava_bacterial_blight", "cassava_brown_streak_disease", "cassava_green_mottle", "cassava_healthy"]
}

def generate_mock_data(num_records=200):
    print(f"Starting to insert {num_records} records...")
    
    for i in range(num_records):
        # Chọn ngẫu nhiên vùng
        region_name = random.choice(list(REGIONS.keys()))
        region = REGIONS[region_name]
        
        # Tạo tọa độ ngẫu nhiên trong vùng
        lat = random.uniform(region["lat_min"], region["lat_max"])
        lng = random.uniform(region["lng_min"], region["lng_max"])
        
        # Chọn ngẫu nhiên cây
        crop = random.choice(region["crops"])
        
        # Lấy danh sách bệnh của cây đó, nếu không có lấy default
        diseases = CROP_DISEASES.get(crop, [f"{crop}_healthy", f"{crop}_disease"])
        
        # Giả lập xác suất 70% là có bệnh, 30% là healthy
        if random.random() < 0.7:
            prediction = random.choice([d for d in diseases if "healthy" not in d])
            probability = random.uniform(0.4, 0.95)
        else:
            prediction = next((d for d in diseases if "healthy" in d), f"{crop}_healthy")
            probability = random.uniform(0.7, 0.99)
            
        # Thời gian ngẫu nhiên trong 14 ngày qua
        days_ago = random.randint(0, 14)
        scan_time = datetime.datetime.now() - datetime.timedelta(days=days_ago, hours=random.randint(0, 23))
        
        record = {
            "prediction": prediction,
            "probability": probability,
            "crop_name_vi": "Mock",
            "image_url": "https://via.placeholder.com/150", 
            "timestamp": scan_time.strftime("%Y-%m-%d %H:%M:%S"),
            "lat": lat,
            "lng": lng
        }
        
        try:
            supabase.table("scan_history").insert(record).execute()
            if i % 10 == 0:
                print(f"Inserted {i} records...")
        except Exception as e:
            print(f"Error: {e}")
            
    print("Done!")

if __name__ == "__main__":
    generate_mock_data(200)
