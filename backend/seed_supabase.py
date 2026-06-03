import uuid
import time
from supabase import create_client
import sys
from pathlib import Path

# Thêm backend vào path để import config
sys.path.insert(0, str(Path(__file__).parent))
from config import SUPABASE_URL, SUPABASE_KEY

def seed_data():
    if not SUPABASE_KEY or "sb_secret" not in SUPABASE_KEY:
        print("Lỗi: SUPABASE_KEY không hợp lệ hoặc chưa được cấu hình.")
        return

    print("--- KHỞI CHẠY QUY TRÌNH BƠM DỮ LIỆU TỰ ĐỘNG ---")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. TẠO NGƯỜI DÙNG MẪU (PROFILES)
    users = [
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "username": "mink_admin",
            "full_name": "Mink Admin",
            "email": "admin@agrisocial.vn",
            "role": "admin",
            "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Mink"
        },
        {
            "id": "00000000-0000-0000-0000-000000000002",
            "username": "dr_green",
            "full_name": "Dr. Green (Chuyên gia)",
            "email": "drgreen@agrisocial.vn",
            "role": "expert",
            "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Green"
        },
        {
            "id": "00000000-0000-0000-0000-000000000003",
            "username": "farmer_vinh",
            "full_name": "Nông dân Vinh",
            "email": "vinh@gmail.com",
            "role": "user",
            "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Vinh"
        }
    ]

    print(f"Đang tạo {len(users)} tài khoản mẫu...")
    for u in users:
        try:
            supabase.table('profiles').upsert(u).execute()
            print(f" -> Đã tạo: {u['full_name']} ({u['role']})")
        except Exception as e:
            print(f" -> Lỗi tạo user {u['full_name']}: {e}")

    # 2. TẠO BÀI VIẾT MẪU (POSTS)
    posts = [
        {
            "user_id": users[1]["id"],
            "caption": "Kỹ thuật trồng Lúa ST25 đạt năng suất cao: Hướng dẫn chi tiết cách bón phân và quản lý nước cho giống lúa ngon nhất thế giới ST25 trong vụ Đông Xuân. Hãy đảm bảo bón đủ Kali ở giai đoạn làm đòng nhé bà con! 🌾 #Rice #ExpertTips",
            "crop_name": "Lúa",
            "image_url": "https://images.unsplash.com/photo-1536633340742-134a62e40101?auto=format&fit=crop&w=1200&q=80"
        },
        {
            "user_id": users[1]["id"],
            "caption": "Bí quyết để Sầu riêng Ri6 cơm vàng hạt lép đạt tiêu chuẩn xuất khẩu: Quản lý sâu đục quả và rệp sáp là yếu tố then chốt. Cần kiểm tra vườn thường xuyên vào giai đoạn trái non. 🍈👑 #Durian #ExportStandard",
            "crop_name": "Trái cây",
            "image_url": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?auto=format&fit=crop&w=1200&q=80"
        },
        {
            "user_id": users[0]["id"],
            "caption": "Cà phê Robusta Tây Nguyên đang vào mùa thu hoạch. Năm nay thời tiết thuận lợi nên năng suất dự kiến tăng 15%. Chúc mừng bà con vùng cao! ☕⛰️ #Coffee #CentralHighlands",
            "crop_name": "Cây công nghiệp",
            "image_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80"
        },
        {
            "user_id": users[2]["id"],
            "caption": "Mô hình dưa lưới nhà màng công nghệ cao: Ứng dụng hệ thống tưới nhỏ giọt giúp tiết kiệm 40% lượng nước và đảm bảo độ ngọt đồng đều. Rất đáng để đầu tư! 🍈💎 #SmartFarm #Melon",
            "crop_name": "Trái cây",
            "image_url": "https://images.unsplash.com/photo-1592394933243-951d16a515f5?auto=format&fit=crop&w=1200&q=80"
        },
        {
            "user_id": users[1]["id"],
            "caption": "Rau sạch thủy canh - Giải pháp cho nông nghiệp đô thị. Không cần đất, chỉ cần dinh dưỡng và ánh sáng, bạn có thể tự trồng rau tại ban công. 🥗🏙️ #Hydroponics #Organic",
            "crop_name": "Rau củ",
            "image_url": "https://images.unsplash.com/photo-1558449197-5788cd91fd6b?auto=format&fit=crop&w=1200&q=80"
        },
        {
            "user_id": users[2]["id"],
            "caption": "Kỹ thuật bón phân cho Ngô lai trong vụ Đông: Chia làm 3 giai đoạn chính để cây phát triển bộ rễ vững chắc và bắp to đều. 🌽🍂 #Maize #WinterCrop",
            "crop_name": "Ngô",
            "image_url": "https://images.unsplash.com/photo-1551739440-5dd934d3a94a?auto=format&fit=crop&w=1200&q=80"
        },
        {
            "user_id": users[1]["id"],
            "caption": "Thanh long ruột đỏ Bình Thuận đạt chứng nhận GlobalGAP: Mở rộng đường sang thị trường Châu Âu. Thành quả xứng đáng cho nỗ lực của bà con. 🌵❤️ #DragonFruit #GlobalGAP",
            "crop_name": "Trái cây",
            "image_url": "https://images.unsplash.com/photo-1527324688151-0e627063f2b1?auto=format&fit=crop&w=1200&q=80"
        },
        {
            "user_id": users[0]["id"],
            "caption": "Chào mừng bà con đến với cộng đồng AgriSocial v3! Đây là nơi chúng ta cùng nhau số hóa ngành nông nghiệp Việt Nam. Hãy chia sẻ ảnh cây trồng của bạn nhé! 🌱🚀",
            "crop_name": "Hệ thống",
            "image_url": "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1200&q=80"
        },
        {
            "user_id": users[1]["id"],
            "caption": "Cách nhận biết sớm bệnh chổi rồng trên sắn: Những dấu hiệu đầu tiên bà con cần lưu ý để tránh lây lan ra diện rộng. 🥔🐛 #Cassava #PestControl",
            "crop_name": "Sắn",
            "image_url": "https://images.unsplash.com/photo-1628151015968-3a4429e9ef04?auto=format&fit=crop&w=1200&q=80"
        },
        {
            "user_id": users[2]["id"],
            "caption": "Vườn tiêu hữu cơ của tôi sau 2 năm chăm sóc. Không dùng phân hóa học, chỉ dùng phân bò ủ hoai và chế phẩm sinh học. Chất lượng hạt thơm nồng khác hẳn! 🧂🌿 #Pepper #OrganicFarming",
            "crop_name": "Cây công nghiệp",
            "image_url": "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=1200&q=80"
        }
    ]

    print(f"Đang bơm {len(posts)} bài viết mẫu...")
    inserted_posts = []
    for p in posts:
        try:
            res = supabase.table('posts').insert(p).execute()
            if res.data:
                inserted_posts.append(res.data[0])
            print(f" -> Đã đăng bài: {p['caption'][:30]}...")
        except Exception as e:
            print(f" -> Lỗi đăng bài: {e}")

    # 3. TẠO BÌNH LUẬN MẪU (COMMENTS)
    if inserted_posts:
        print("Đang tạo các tương tác mẫu (bình luận)...")
        sample_comments = [
            {"user_id": users[0]["id"], "content": "Bài viết rất hữu ích bác sĩ ơi! 👍"},
            {"user_id": users[2]["id"], "content": "Em sẽ áp dụng ngay vào ruộng nhà mình."},
            {"user_id": users[1]["id"], "content": "Bà con cần hỗ trợ gì cứ nhắn tin trực tiếp cho mình nhé."}
        ]
        
        for post in inserted_posts:
            # Mỗi bài viết cho 1-2 comment ngẫu nhiên
            for _ in range(2):
                cmt = random.choice(sample_comments).copy()
                cmt["post_id"] = post["id"]
                try:
                    supabase.table('comments').insert(cmt).execute()
                except:
                    pass
        print(" -> Đã hoàn tất tương tác mẫu.")

    print("\n=== HOÀN TẤT QUY TRÌNH BƠM DỮ LIỆU! ===")
    print("Bây giờ bạn có thể mở web để kiểm tra thành quả.")

import random
if __name__ == "__main__":
    seed_data()
