import os
import sys
from pathlib import Path
from supabase import create_client

# Thêm backend vào path
sys.path.insert(0, str(Path(__file__).parent))
from config import SUPABASE_URL, SUPABASE_KEY

def purify_database():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("--- ĐANG DỌN DẸP DATABASE (CHẾ ĐỘ THUẦN NÔNG NGHIỆP) ---")
    
    # 1. Xóa toàn bộ bài viết cũ để làm sạch
    supabase.table('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    print("-> Đã xóa các bài viết không phù hợp.")

    # 2. Danh sách bài viết tri thức nông nghiệp thuần túy (Chỉ tập trung dữ liệu & kỹ thuật)
    pure_posts = [
        {
            "caption": "Dữ liệu năng suất Lúa ST25: Qua thực nghiệm tại vùng ĐBSCL, giống ST25 cho năng suất trung bình 6.5-7.2 tấn/ha. Thời gian sinh trưởng từ 95-105 ngày. Yêu cầu kỹ thuật: Bón phân chia làm 4 đợt, chú trọng đợt đón đòng bằng Kali trắng.",
            "crop_name": "Lúa lương thực",
            "image_url": "https://images.unsplash.com/photo-1536633340742-134a62e40101?auto=format&fit=crop&w=800&q=80" # Giữ ảnh minh họa trừ khi user yêu cầu xóa hẳn
        },
        {
            "caption": "Quy trình kiểm soát sâu bệnh hại trên Ngô: Đối với sâu keo mùa thu (Spodoptera frugiperda), ngưỡng kinh tế để phun thuốc là khi tỷ lệ cây bị hại trên 20%. Ưu tiên sử dụng các chế phẩm sinh học chứa Bacillus thuringiensis.",
            "crop_name": "Cây lương thực",
            "image_url": "https://images.unsplash.com/photo-1551739440-5dd934d3a94a?auto=format&fit=crop&w=800&q=80"
        },
        {
            "caption": "Phân tích thổ nhưỡng cho cây Cà phê: Đất đỏ Bazan có độ pH lý tưởng từ 5.0-6.0. Hàm lượng hữu cơ cần duy trì trên 3%. Khuyến nghị bón bổ sung Magie và kẽm vào đầu mùa mưa để tránh hiện tượng rụng quả non.",
            "crop_name": "Cây công nghiệp",
            "image_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80"
        },
        {
            "caption": "Kỹ thuật canh tác Rau sạch thủy canh: Nồng độ dinh dưỡng (PPM) cho rau muống là 800-1000, cho xà lách là 600-800. Độ pH nước cần duy trì ổn định ở mức 5.8-6.2 để cây hấp thụ dinh dưỡng tối ưu.",
            "crop_name": "Rau thực phẩm",
            "image_url": "https://images.unsplash.com/photo-1558449197-5788cd91fd6b?auto=format&fit=crop&w=800&q=80"
        },
        {
            "caption": "Dữ liệu xuất khẩu Thanh long: Tiêu chuẩn GlobalGAP yêu cầu kiểm soát dư lượng thuốc bảo vệ thực vật dưới ngưỡng 0.01mg/kg. Thời gian cách ly trước thu hoạch tối thiểu 14 ngày đối với các nhóm thuốc trừ nấm.",
            "crop_name": "Trái cây xuất khẩu",
            "image_url": "https://images.unsplash.com/photo-1527324688151-0e627063f2b1?auto=format&fit=crop&w=800&q=80"
        }
    ]

    # Lấy admin user id chuẩn UUID
    admin_id = "00000000-0000-0000-0000-000000000001"
    
    for p in pure_posts:
        p['user_id'] = admin_id
        try:
            supabase.table('posts').insert(p).execute()
            print(f"-> Đã nạp dữ liệu tri thức: {p['crop_name']}")
        except Exception as e:
            print(f"-> Lỗi nạp bài {p['crop_name']}: {e}")
    
    print("=== DATABASE ĐÃ ĐƯỢC CHUẨN HÓA THUẦN NÔNG NGHIỆP! ===")

if __name__ == "__main__":
    purify_database()
