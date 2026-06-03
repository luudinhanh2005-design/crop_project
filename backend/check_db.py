import sys
from pathlib import Path
from supabase import create_client

# Thêm backend vào path
sys.path.insert(0, str(Path(__file__).parent))
from config import SUPABASE_URL, SUPABASE_KEY

def check():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    res = supabase.table('posts').select("*", count='exact').execute()
    print(f"SỐ LƯỢNG BÀI VIẾT TRÊN DATABASE: {res.count}")
    
    if res.count > 0:
        print("DANH SÁCH 3 BÀI ĐẦU TIÊN:")
        for p in res.data[:3]:
            print(f"- {p.get('caption')[:50]}... (Crop: {p.get('crop_name')})")

if __name__ == "__main__":
    check()
