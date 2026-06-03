import os
import sys
from pathlib import Path
from supabase import create_client

# Thêm backend vào path
sys.path.insert(0, str(Path(__file__).parent))
from config import SUPABASE_URL, SUPABASE_KEY

def final_purify():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    admin_id = "00000000-0000-0000-0000-000000000001"
    expert_id = "00000000-0000-0000-0000-000000000002"
    
    print("--- ĐANG CHUẨN HÓA TOÀN BỘ HỆ THỐNG NÔNG NGHIỆP ---")
    
    # 1. Xóa sạch mọi bài viết cũ
    supabase.table('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    print("-> Đã dọn dẹp sạch sẽ kho dữ liệu cũ.")

    # 2. Danh sách bài viết & hình ảnh tương xứng 100%
    agriculture_data = [
        {
            "user_id": expert_id,
            "caption": "Kỹ thuật canh tác Lúa nước thâm canh (SRI): Áp dụng phương pháp cấy mạ non và tưới khô xen kẽ giúp hệ rễ phát triển mạnh, giảm 30% lượng giống và 40% lượng nước tưới. Đây là chìa khóa cho năng suất lúa bền vững. 🌾",
            "crop_name": "Lúa gạo",
            "image_url": "https://images.unsplash.com/photo-1536633340742-134a62e40101?auto=format&fit=crop&w=1000&q=80"
        },
        {
            "user_id": expert_id,
            "caption": "Quản lý dịch hại trên Ngô lai: Sâu keo mùa thu là đối tượng nguy hiểm nhất hiện nay. Bà con cần chú ý ngắt lá có ổ trứng và sử dụng bẫy bả sinh học ngay từ giai đoạn ngô 3-5 lá. 🌽",
            "crop_name": "Cây lương thực",
            "image_url": "https://images.unsplash.com/photo-1551739440-5dd934d3a94a?auto=format&fit=crop&w=1000&q=80"
        },
        {
            "user_id": admin_id,
            "caption": "Mô hình xen canh Đậu nành trong vườn cây ăn quả: Đậu nành giúp cố định đạm sinh học, cải tạo độ phì nhiêu cho đất và tăng thêm thu nhập trên cùng một đơn vị diện tích. 🌿",
            "crop_name": "Đậu đỗ",
            "image_url": "https://images.unsplash.com/photo-1594754707154-15024479f67a?auto=format&fit=crop&w=1000&q=80"
        },
        {
            "user_id": expert_id,
            "caption": "Kỹ thuật thu hoạch và bảo quản Khoai tây vụ Đông: Để tránh trầy xước và thối củ, bà con nên thu hoạch vào ngày nắng ráo, để củ ráo vỏ ngay tại ruộng trước khi đưa vào kho bảo quản thoáng mát. 🥔",
            "crop_name": "Cây lương thực",
            "image_url": "https://images.unsplash.com/photo-1518977676601-b53f02ac6d31?auto=format&fit=crop&w=1000&q=80"
        },
        {
            "user_id": admin_id,
            "caption": "Phát triển giống Sắn (Khoai mì) kháng bệnh khảm lá: Việc sử dụng các giống sạch bệnh như HN1, HN5 là yếu tố tiên quyết để duy trì vùng nguyên liệu sắn phục vụ sản xuất công nghiệp và thức ăn chăn nuôi. 🥔",
            "crop_name": "Cây lương thực",
            "image_url": "https://images.unsplash.com/photo-1628151015968-3a4429e9ef04?auto=format&fit=crop&w=1000&q=80"
        },
        {
            "user_id": expert_id,
            "caption": "Ứng dụng hệ thống tưới nhỏ giọt cho cây công nghiệp: Tiết kiệm nước và bón phân qua hệ thống tưới giúp cây hấp thụ dinh dưỡng đồng đều, giảm thất thoát phân bón lên đến 50%. 💧",
            "crop_name": "Nông nghiệp kỹ thuật",
            "image_url": "https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=1000&q=80"
        },
        {
            "user_id": admin_id,
            "caption": "Cánh đồng lúa mì vàng óng chuẩn bị vào vụ thu hoạch. Việc kiểm soát độ ẩm hạt dưới 14% là cực kỳ quan trọng để đảm bảo chất lượng bột mì cho sản xuất thực phẩm. 🌾✨",
            "crop_name": "Lúa mì",
            "image_url": "https://images.unsplash.com/photo-1501430654243-c93f4a0a3fe9?auto=format&fit=crop&w=1000&q=80"
        },
        {
            "user_id": expert_id,
            "caption": "Phòng trừ bệnh đạo ôn trên lúa: Bà con tránh bón thừa đạm khi thời tiết có sương mù, độ ẩm cao. Sử dụng các loại thuốc đặc hiệu ngay khi vết bệnh chớm xuất hiện hình mắt én. 🌾🔬",
            "crop_name": "Lúa gạo",
            "image_url": "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1000&q=80"
        },
        {
            "user_id": admin_id,
            "caption": "Vẻ đẹp của lao động trên cánh đồng rau sạch. Việc tuân thủ thời gian cách ly thuốc bảo vệ thực vật là cam kết vàng của nhà nông với sức khỏe người tiêu dùng. 🥦🥗",
            "crop_name": "Rau thực phẩm",
            "image_url": "https://images.unsplash.com/photo-1592419044706-39796d40f98c?auto=format&fit=crop&w=1000&q=80"
        },
        {
            "user_id": expert_id,
            "caption": "Canh tác hữu cơ - Hướng đi bền vững cho nông nghiệp Việt Nam. Việc tận dụng phế phụ phẩm nông nghiệp làm phân bón giúp giảm chi phí và bảo vệ hệ sinh thái đất ruộng. 🌱🛡️",
            "crop_name": "Nông nghiệp bền vững",
            "image_url": "https://images.unsplash.com/photo-1624454002302-36b824d7bd0a?auto=format&fit=crop&w=1000&q=80"
        }
    ]

    for p in agriculture_data:
        try:
            supabase.table('posts').insert(p).execute()
            print(f"-> Đã nạp bài: {p['crop_name']}")
        except Exception as e:
            print(f"-> Lỗi nạp {p['crop_name']}: {e}")
            
    print("=== TẤT CẢ NỘI DUNG ĐÃ ĐƯỢC CHUẨN HÓA THÀNH CÔNG! ===")

if __name__ == "__main__":
    final_purify()
