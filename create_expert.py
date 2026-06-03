import sqlite3
import bcrypt
import uuid
import sys
import os
from pathlib import Path

# Đảm bảo script có thể tìm thấy file config.py
sys.path.insert(0, str(Path(__file__).parent / "backend"))
# pyrefly: ignore [missing-import]
from config import SUPABASE_URL, SUPABASE_KEY
# pyrefly: ignore [missing-import]

def create_expert_account(username, password, email, full_name):
    db_path = Path(__file__).parent / "backend" / "auth.db"
    
    # 1. Mã hóa mật khẩu bằng bcrypt (giống logic trong api.py)
    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    user_id = str(uuid.uuid4())

    print(f"--- Đang tạo tài khoản Chuyên gia: {username} ---")

    # 2. Thêm vào SQLite local (auth.db) để có thể đăng nhập
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO custom_users (id, username, password_hash, email, role) VALUES (?, ?, ?, ?, ?)", 
            (user_id, username, password_hash, email, 'expert')
        )
        conn.commit()
        print(f"✅ [SQLite] Đã tạo tài khoản trong auth.db")
    except sqlite3.IntegrityError:
        print(f"❌ [Lỗi] Tên đăng nhập '{username}' đã tồn tại trong database local.")
        conn.close()
        return
    finally:
        conn.close()

    # 3. Đồng bộ lên Supabase profiles
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            from supabase import create_client
            supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
            profile_data = {
                "id": user_id,
                "username": username,
                "full_name": full_name,
                "email": email,
                "role": "expert"
            }
            supabase.table("profiles").upsert(profile_data).execute()
            print(f"✅ [Supabase] Đã đồng bộ profile chuyên gia cho: {full_name}")
        except Exception as e:
            print(f"⚠️ [Cảnh báo] Không thể đồng bộ lên Supabase: {e}")
            print("   (Bạn vẫn có thể đăng nhập local nếu server đang chạy chế độ không dùng Supabase)")

if __name__ == "__main__":
    # THÔNG TIN TÀI KHOẢN MỚI
    create_expert_account(
        username="expert_account", 
        password="ExpertPassword123", 
        email="expert@agrisocial.vn", 
        full_name="Chuyên Gia Nông Nghiệp"
    )
    print("\n🚀 Xong! Bây giờ bạn có thể đăng nhập với username: expert_account")