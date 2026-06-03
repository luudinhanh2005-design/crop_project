import uuid
import json
from supabase import create_client
import sys
import os
from pathlib import Path

# Đảm bảo Python tìm thấy thư mục backend để import config
current_dir = Path(__file__).parent.absolute()
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

import config  # type: ignore[import-untyped]

SUPABASE_URL: str = config.SUPABASE_URL
SUPABASE_KEY: str = config.SUPABASE_KEY

def seed_calendar_master_data():
    if not SUPABASE_KEY or "sb_secret" not in SUPABASE_KEY:
        print("Lỗi: SUPABASE_KEY không hợp lệ.")
        return

    print("--- SEEDING MASTER CALENDAR DATA ---")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    master_data = [
        {
            "crop_key": "rice",
            "region": "ĐBSCL",
            "planting_season": "Đông Xuân",
            "stages": [
                {"title": "Sạ lúa (Gieo hạt)", "offset_days": 0, "important": True},
                {"title": "Bón phân đợt 1 (Thúc chồi)", "offset_days": 10, "important": False},
                {"title": "Bón phân đợt 2 (Đẻ nhánh)", "offset_days": 25, "important": True},
                {"title": "Bón phân đợt 3 (Đón đòng)", "offset_days": 45, "important": True},
                {"title": "Phun thuốc ngừa đạo ôn & sâu cuốn lá", "offset_days": 60, "important": False},
                {"title": "Rút nước cạn mặt ruộng", "offset_days": 85, "important": False},
                {"title": "Thu hoạch lúa", "offset_days": 95, "important": True}
            ]
        },
        {
            "crop_key": "corn",
            "region": "ĐBSCL",
            "planting_season": "Quanh năm",
            "stages": [
                {"title": "Gieo hạt ngô", "offset_days": 0, "important": True},
                {"title": "Bón thúc đợt 1 (3-5 lá)", "offset_days": 15, "important": False},
                {"title": "Bón thúc đợt 2 (7-9 lá)", "offset_days": 30, "important": True},
                {"title": "Bón thúc đợt 3 (Xoắn nõn)", "offset_days": 50, "important": True},
                {"title": "Phun thuốc ngừa sâu keo mùa thu", "offset_days": 40, "important": False},
                {"title": "Thu hoạch ngô", "offset_days": 90, "important": True}
            ]
        },
        {
            "crop_key": "cassava",
            "region": "Tây Nguyên",
            "planting_season": "Đầu mùa mưa",
            "stages": [
                {"title": "Đặt hom sắn", "offset_days": 0, "important": True},
                {"title": "Dặm cây chết & Làm cỏ đợt 1", "offset_days": 20, "important": False},
                {"title": "Bón phân đợt 1", "offset_days": 40, "important": True},
                {"title": "Bón phân đợt 2 & Vun gốc", "offset_days": 80, "important": True},
                {"title": "Kiểm tra rệp sáp & Bệnh khảm lá", "offset_days": 120, "important": False},
                {"title": "Thu hoạch sắn", "offset_days": 270, "important": True}
            ]
        }
    ]

    for data in master_data:
        try:
            # Check if exists
            check = supabase.table('master_seasonal_data').select("*").eq('crop_key', data['crop_key']).eq('region', data['region']).execute()
            if not check.data:
                supabase.table('master_seasonal_data').insert(data).execute()
                print(f" -> Added master data for: {data['crop_key']}")
            else:
                print(f" -> Data for {data['crop_key']} already exists.")
        except Exception as e:
            print(f" -> Error seeding {data['crop_key']}: {e}")

    print("--- COMPLETED ---")

if __name__ == "__main__":
    seed_calendar_master_data()
