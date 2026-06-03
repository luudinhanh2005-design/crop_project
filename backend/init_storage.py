<<<<<<< HEAD
from config import SUPABASE_URL, SUPABASE_KEY
from supabase import create_client

def init():
    print(f"Connecting to {SUPABASE_URL}...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Tạo bucket
    try:
        res = supabase.storage.create_bucket('scans', options={'public': True})
        print("✅ Đã tạo Bucket 'scans' thành công!")
    except Exception as e:
        if "already exists" in str(e).lower():
            print("ℹ️ Bucket 'scans' đã tồn tại.")
        else:
            print(f"❌ Lỗi tạo Bucket: {e}")

if __name__ == "__main__":
    init()
=======
from config import SUPABASE_URL, SUPABASE_KEY
from supabase import create_client

def init():
    print(f"Connecting to {SUPABASE_URL}...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Tạo bucket
    try:
        res = supabase.storage.create_bucket('scans', options={'public': True})
        print("✅ Đã tạo Bucket 'scans' thành công!")
    except Exception as e:
        if "already exists" in str(e).lower():
            print("ℹ️ Bucket 'scans' đã tồn tại.")
        else:
            print(f"❌ Lỗi tạo Bucket: {e}")

if __name__ == "__main__":
    init()
>>>>>>> 3f515203aca5266db896be604e6201162c6b8dd4
