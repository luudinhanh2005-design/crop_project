import os
import sys
from pathlib import Path
from supabase import create_client

# Thêm backend vào path
sys.path.insert(0, str(Path(__file__).parent))
from config import SUPABASE_URL, SUPABASE_KEY

def technical_only_purify():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    admin_id = "00000000-0000-0000-0000-000000000001"
    
    print("--- CHẾ ĐỘ THUẦN DỮ LIỆU KỸ THUẬT (KHÔNG HÌNH ẢNH) ---")
    
    # 1. Xóa sạch mọi bài viết cũ
    supabase.table('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    print("-> Đã xóa toàn bộ bài đăng cũ.")

    # 2. Danh sách dữ liệu tri thức nông nghiệp thuần văn bản
    tech_data = [
        {
            "user_id": admin_id,
            "caption": "BÁO CÁO KỸ THUẬT LÚA ST25: Năng suất thực tế tại Sóc Trăng đạt 7.5 tấn/ha. Mật độ gieo sạ khuyến nghị: 80-100kg/ha. Chế độ bón phân: NPK 20-20-15 ở giai đoạn 20 ngày sau sạ (NSS) và 45 NSS. Hiệu quả kháng đạo ôn: Cấp 3.",
            "crop_name": "Lúa gạo",
            "image_url": None # Không thu thập ảnh
        },
        {
            "user_id": admin_id,
            "caption": "SỐ LIỆU NGÔ LAI VỤ ĐÔNG: Giống ngô CP511 cho thấy khả năng chịu hạn tốt. Tỷ lệ nảy mầm đạt 98%. Thời gian sinh trưởng 110 ngày. Lưu ý: Cần bón lót phân chuồng hoai mục 5-10 tấn/ha để cải tạo cấu trúc đất.",
            "crop_name": "Cây lương thực",
            "image_url": None
        },
        {
            "user_id": admin_id,
            "caption": "PHÂN TÍCH THỔ NHƯỠNG TÂY NGUYÊN: Các mẫu đất đỏ Bazan tại Đắk Lắk cho thấy hàm lượng lân dễ tiêu thấp. Cần bổ sung Lân nung chảy (15-17% P2O5) với liều lượng 500kg/ha cho chu kỳ kiến thiết cơ bản của cây cà phê.",
            "crop_name": "Đất trồng",
            "image_url": None
        },
        {
            "user_id": admin_id,
            "caption": "DỮ LIỆU CANH TÁC KHOAI TÂY: Nhiệt độ lý tưởng cho quá trình xuống củ là 15-20 độ C. Nếu nhiệt độ ban đêm trên 25 độ C, năng suất sẽ giảm 40%. Độ ẩm đất cần duy trì ở mức 75-80% trong suốt giai đoạn hình thành củ.",
            "crop_name": "Cây lương thực",
            "image_url": None
        },
        {
            "user_id": admin_id,
            "caption": "TIÊU CHUẨN XUẤT KHẨU SẮN (KHOAI MÌ): Độ bột yêu cầu đạt tối thiểu 28%. Độ tạp chất dưới 3%. Kiểm soát chặt chẽ bệnh khảm lá virus (SLCMD) thông qua việc tiêu hủy tàn dư cây bệnh ngay sau thu hoạch.",
            "crop_name": "Cây lương thực",
            "image_url": None
        }
    ]

    for p in tech_data:
        try:
            supabase.table('posts').insert(p).execute()
            print(f"-> Đã nạp dữ liệu kỹ thuật: {p['crop_name']}")
        except Exception as e:
            print(f"-> Lỗi nạp: {e}")
            
    print("=== ĐÃ CHUYỂN ĐỔI SANG HỆ THỐNG THUẦN DỮ LIỆU THÀNH CÔNG! ===")

if __name__ == "__main__":
    technical_only_purify()
