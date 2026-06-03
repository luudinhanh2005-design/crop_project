# explore.py
import time
import random
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ---------- Fix imports with relative paths and fallbacks ----------
try:
    from ..services.search_service import SearchService
except ImportError:
    # Fallback dummy SearchService if module missing
    class SearchService:
        @staticmethod
        def calculate_match_score(query: str, text: str) -> float:
            # Simple token overlap ratio fallback
            query_words = set(query.lower().split())
            text_words = set(text.lower().split())
            if not query_words:
                return 0.0
            overlap = len(query_words & text_words)
            return overlap / len(query_words)

try:
    from ..services.ai_service import AIService
except ImportError:
    # Fallback dummy AIService
    class AIService:
        @staticmethod
        def generate_crop_analysis(crop: str, temp: float, humidity: float, region: str) -> str:
            return f"Phân tích sơ bộ: {crop} phù hợp với điều kiện nhiệt độ {temp}°C, độ ẩm {humidity}% tại {region}. (AI service chưa sẵn sàng)"

try:
    from ..config import CROP_DETAILS, USE_SUPABASE, SUPABASE_URL, SUPABASE_KEY
except ImportError:
    CROP_DETAILS = {}
    USE_SUPABASE = False
    SUPABASE_URL = None
    SUPABASE_KEY = None

try:
    from ..api import supabase
except ImportError:
    supabase = None

# Khởi tạo router
router = APIRouter(prefix="/api/explore", tags=["Explore Hub"])

# Bộ đếm view in-memory phục vụ cho xu hướng động
in_memory_crop_views: Dict[str, int] = {
    "rice": 1250,
    "corn": 850,
    "wheat": 420,
    "potato": 320,
    "cassava": 150
}

# Bộ đếm rate limit đơn giản phòng chống DDoS/Spam API
rate_limit_store: Dict[str, List[float]] = {}

def check_rate_limit(ip: str):
    now = time.time()
    if ip not in rate_limit_store:
        rate_limit_store[ip] = []
    # Dọn dẹp các timestamp cũ quá 1 phút
    rate_limit_store[ip] = [t for t in rate_limit_store[ip] if now - t < 60]
    if len(rate_limit_store[ip]) > 30:  # Max 30 requests/phút
        raise HTTPException(status_code=429, detail="Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.")
    rate_limit_store[ip].append(now)

# Dữ liệu thời vụ 12 tháng tại 3 miền Bắc - Trung - Nam
SEASONAL_DATA = {
    "Bắc": {
        1: {"weather": "Lạnh, hanh khô, có sương muối.", "plant": ["Rau cải", "Su hào", "Khoai tây"], "care": ["Tưới ủ ấm gốc", "Tránh sương muối"], "harvest": ["Cải bắp", "Hoa tết"], "warning": "Đề phòng sương muối rét đậm hại mạ."},
        2: {"weather": "Mưa xuân ấm áp, độ ẩm cao.", "plant": ["Lúa vụ xuân", "Bắp cải", "Cà chua"], "care": ["Làm đất kỹ", "Phun ngừa nấm"], "harvest": ["Khoai tây vụ đông"], "warning": "Mưa xuân ẩm thấp dễ phát sinh nấm bệnh."},
        5: {"weather": "Nắng nóng, bắt đầu có mưa rào.", "plant": ["Lúa vụ hè thu", "Ngô hè", "Rau muống"], "care": ["Thoát nước nhanh", "Bón lót đạm"], "harvest": ["Lúa xuân muộn", "Dưa hấu"], "warning": "Nhiệt độ tăng cao, đề phòng sâu vẽ bùa."},
        6: {"weather": "Nắng nóng gay gắt, mưa bão.", "plant": ["Rau đay", "Mướp", "Lúa hè thu"], "care": ["Dọn cỏ bờ ruộng", "Khơi thông rãnh"], "harvest": ["Xoài", "Vải thiều"], "warning": "Bão quét, đề phòng lúa đổ ngã."},
        10: {"weather": "Hanh khô, se lạnh về đêm.", "plant": ["Lúa đông xuân", "Tỏi", "Hành tây"], "care": ["Tưới rãnh giữa ngày", "Ủ rơm"], "harvest": ["Lúa hè thu muộn"], "warning": "Đất nứt nẻ hanh khô, cần giữ nước gốc."},
    },
    "Trung": {
        5: {"weather": "Nắng gắt, gió Lào khô nóng.", "plant": ["Lúa hè thu", "Lạc", "Mè (Vừng)"], "care": ["Tưới thấm mát", "Phủ bạt chống bốc hơi"], "harvest": ["Đậu xanh vụ xuân"], "warning": "Gió Lào khô nóng làm khô héo hoa màu nhanh chóng."},
        9: {"weather": "Mưa lũ lớn dồn dập.", "plant": ["Rau màu ngắn ngày"], "care": ["Chằng chống nhà màng", "Thoát lũ"], "harvest": ["Mía"], "warning": "Ngập úng diện rộng vùng trũng thấp."},
    },
    "Nam": {
        5: {"weather": "Nắng nóng xen kẽ mưa dông lớn đầu mùa.", "plant": ["Lúa hè thu", "Sầu riêng", "Chôm chôm"], "care": ["Bón phân đón mưa", "Tạo rãnh thoát nước"], "harvest": ["Xoài cát", "Măng cụt"], "warning": "Đề phòng mưa giông lốc giật làm rụng hoa quả non."},
        11: {"weather": "Nắng ấm, khí hậu mát mẻ ôn hòa.", "plant": ["Lúa đông xuân", "Dưa hấu tết", "Cải ngọt"], "care": ["Tưới phun sương định kỳ", "Bón thúc kali"], "harvest": ["Lúa vụ thu đông"], "warning": "Triều cường dâng cao gây nhiễm mặn vùng ven sông."},
    }
}

# Dữ liệu Bản đồ Nông nghiệp
MAP_REGIONS = [
    {"name": "Mekong Delta", "lat": 10.0, "lon": 105.5, "crop_density": 85, "disease_severity": 12, "status": "Hữu cơ tốt"},
    {"name": "Tây Nguyên", "lat": 12.5, "lon": 108.0, "crop_density": 70, "disease_severity": 25, "status": "Rỉ sắt cà phê"},
    {"name": "Đồng bằng Sông Hồng", "lat": 21.0, "lon": 106.0, "crop_density": 90, "disease_severity": 15, "status": "Lúa bội thu"},
    {"name": "Duyên hải Miền Trung", "lat": 16.0, "lon": 108.2, "crop_density": 45, "disease_severity": 30, "status": "Hạn mặn nhẹ"}
]

# ────────────────────────────────────────────────────────
# 1. API: LẤY TIN TỨC NỔI BẬT (CAROUSEL)
# ────────────────────────────────────────────────────────
@router.get("/hero-news")
def get_hero_news():
    """Trả về danh sách tin tức nổi bật và tiêu điểm 2026"""
    fallback_news = [
        {
            "id": "hn1",
            "title": "Kỹ thuật gieo trồng Sen Đá Kim Cương",
            "summary": "Giống cây dễ chăm sóc, mang lại không gian xanh mát và tài lộc lớn cho gia đình Việt. Đang là xu hướng được quan tâm hàng đầu năm nay.",
            "image_url": "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=1200&q=80",
            "badge": "CÂY CỦA NGÀY",
            "color": "primary",
            "author": "Chuyên gia Mai Lan",
            "tags": ["Sen đá", "Cây cảnh"],
            "is_hero": True
        },
        {
            "id": "hn2",
            "title": "Mô hình Cà Chua Thủy Canh thông minh",
            "summary": "Tối ưu hóa diện tích nhà phố và kiểm soát nguồn nước tưới nhỏ giọt, mang lại sản lượng cà chua hữu cơ đỏ mọng sai trái quanh năm.",
            "image_url": "https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=1200&q=80",
            "badge": "MÔ HÌNH MỚI",
            "color": "secondary",
            "author": "Kỹ sư nông nghiệp Hoàng Bách",
            "tags": ["Thủy canh", "Cà chua"],
            "is_hero": True
        },
        {
            "id": "hn3",
            "title": "Dưa Lưới Huỳnh Long trong nhà màng Israel",
            "summary": "Ứng dụng tiêu chuẩn GlobalGAP, kiểm soát độ ẩm gốc đạt hiệu quả kinh tế gấp 5 lần so với trồng dưa truyền thống.",
            "image_url": "https://images.unsplash.com/photo-1598449356475-b9f71db7d847?auto=format&fit=crop&w=1200&q=80",
            "badge": "TIÊU ĐIỂM",
            "color": "amber-600",
            "author": "Hợp tác xã TechFarm",
            "tags": ["Dưa lưới", "Công nghệ cao"],
            "is_hero": True
        }
    ]
    
    if USE_SUPABASE and supabase:
        try:
            res = supabase.table("explore_news").select("*").eq("is_hero", True).order("created_at", desc=True).execute()
            if res.data and len(res.data) > 0:
                return {"success": True, "data": res.data}
        except Exception as e:
            print(f"[Supabase Error] get_hero_news fallback: {e}")
            
    return {"success": True, "data": fallback_news}

# ────────────────────────────────────────────────────────
# 2. API: TÌM KIẾM ĐA NGUỒN CÓ XẾP HẠNG & CACHE
# ────────────────────────────────────────────────────────
search_cache: Dict[str, tuple] = {}

@router.get("/search")
def search_explore(q: str = Query(""), page: int = Query(1), limit: int = Query(10)):
    if not q:
        return []
    
    q_clean = q.strip().lower()
    now = time.time()
    
    # Đọc từ cache nếu có trong vòng 30 giây
    if q_clean in search_cache:
        cached_data, timestamp = search_cache[q_clean]
        if now - timestamp < 30:
            return cached_data
            
    try:
        results = []
        
        # 1. Quét Cây trồng từ CROP_DETAILS có tính điểm Fuzzy
        for crop_id, details in CROP_DETAILS.items():
            vi_name = details.get("vi", "")
            sci_name = details.get("ten_khoa_hoc", "")
            
            # Tính điểm tương đồng chuẩn hóa
            score = SearchService.calculate_match_score(q_clean, vi_name)
            score_sci = SearchService.calculate_match_score(q_clean, sci_name)
            best_score = max(score, score_sci)
            
            if best_score > 0.35:
                gallery = details.get("gallery", [])
                img = gallery[0] if gallery else "https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=400"
                
                results.append({
                    "type": "crop",
                    "id": crop_id,
                    "title": vi_name,
                    "subtitle": sci_name or "Cây trồng nông nghiệp",
                    "image_url": img,
                    "score": best_score
                })
        
        # 2. Quét thêm từ Supabase nếu có
        if USE_SUPABASE and supabase:
            # Tìm kiếm tin tức
            try:
                res_news = supabase.table("explore_news").select("*").ilike("title", f"%{q}%").limit(5).execute()
                for n in (res_news.data or []):
                    if isinstance(n, dict):
                        results.append({
                            "type": "news",
                            "id": n.get("id"),
                            "title": n.get("title"),
                            "subtitle": n.get("badge") or "Tin tức",
                            "image_url": n.get("image_url") or "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=1200",
                            "score": 0.75
                        })
            except Exception:
                pass
            
            # Tìm kiếm chuyên gia / user
            try:
                res_users = supabase.table("profiles").select("*").ilike("full_name", f"%{q}%").limit(5).execute()
                for u in (res_users.data or []):
                    if isinstance(u, dict):
                        results.append({
                            "type": "user",
                            "id": u.get("id"),
                            "title": u.get("full_name"),
                            "subtitle": f"Chuyên gia {u.get('role', 'thành viên')}",
                            "image_url": u.get("avatar_url") or "https://i.pravatar.cc/100",
                            "score": 0.70
                        })
            except Exception:
                pass

        # Sắp xếp kết quả theo điểm số giảm dần
        results.sort(key=lambda x: x["score"], reverse=True)
        
        # Phân trang kết quả
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_results = results[start_idx:end_idx]
        
        # Lưu cache
        search_cache[q_clean] = (paginated_results, now)
        return paginated_results
        
    except Exception as e:
        print(f"[Search Engine Error] {e}")
        return []

# ────────────────────────────────────────────────────────
# 3. API: XU HƯỚNG CÂY TRỒNG (TRENDING CROPS)
# ────────────────────────────────────────────────────────
@router.get("/trending-crops")
def get_trending_crops():
    """Lấy danh sách 5 giống cây có lượt tương tác lớn nhất"""
    try:
        if USE_SUPABASE and supabase:
            res = supabase.table("crop_library").select("id, title, crop_type, views, thumbnail_url").order("views", desc=True).limit(5).execute()
            if res.data and len(res.data) > 0:
                crops = []
                for item in res.data:
                    if isinstance(item, dict):
                        crops.append({
                            "id": item.get("id"),
                            "name": item.get("title"),
                            "category": item.get("crop_type") or "Cây trồng",
                            "views": item.get("views") or random.randint(100, 300),
                            "img": item.get("thumbnail_url") or "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=400"
                        })
                return {"success": True, "data": crops}
    except Exception as e:
        print(f"[Supabase Trending Error]: {e}")

    # Fallback dữ liệu trong memory
    sorted_views = sorted(in_memory_crop_views.items(), key=lambda x: x[1], reverse=True)
    crops = []
    for crop_id, views in sorted_views[:5]:
        details = CROP_DETAILS.get(crop_id, {})
        vi_name = details.get("vi", crop_id.capitalize())
        gallery = details.get("gallery", [])
        img = gallery[0] if gallery else "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=400"
        crops.append({
            "id": crop_id,
            "name": vi_name,
            "category": "Cây trồng chất lượng cao",
            "views": views,
            "img": img
        })
    return {"success": True, "data": crops}

# ────────────────────────────────────────────────────────
# 4. API: CHI TIẾT CÂY TRỒNG CÓ CỘNG DỒN VIEW ĐỘNG
# ────────────────────────────────────────────────────────
@router.get("/crops/{crop_name}")
def get_crop_details(crop_name: str):
    crop_name_lower = crop_name.lower()
    found_key: Optional[str] = None
    found_details: Optional[dict] = None
    
    for crop_id, details in CROP_DETAILS.items():
        if crop_id.lower() == crop_name_lower or details.get("vi", "").lower() == crop_name_lower:
            found_key = crop_id
            found_details = details.copy()
            break
            
    if found_details and found_key is not None:
        # Cộng dồn lượt xem in-memory động
        in_memory_crop_views[found_key] = in_memory_crop_views.get(found_key, 0) + 1
        
        # Nếu có Supabase thì đồng bộ đếm views lên bảng DB
        if USE_SUPABASE and supabase:
            try:
                supabase.table("crop_library").update({"views": in_memory_crop_views[found_key]}).eq("title", found_details["vi"]).execute()
            except Exception as e:
                print(f"[Supabase View Count Sync Warn]: {e}")
                
        return {"success": True, "data": found_details}
        
    return JSONResponse(status_code=404, content={"success": False, "error": "Không tìm thấy thông tin giống cây này."})

# ────────────────────────────────────────────────────────
# 5. API: AI PHÂN TÍCH THỜI TIẾT TƯƠNG THÍCH (AI INSIGHT)
# ────────────────────────────────────────────────────────
@router.get("/ai-analysis/{crop}")
def get_ai_analysis(crop: str, temp: float = Query(28.0), humidity: float = Query(70.0), region: str = Query("Nam")):
    """Phân tích mức độ thích nghi khí hậu bằng AI"""
    try:
        analysis = AIService.generate_crop_analysis(crop, temp, humidity, region)
        return {"success": True, "analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích AI: {str(e)}")

# ────────────────────────────────────────────────────────
# 6. API: LỊCH MÙA VỤ THEO KHU VỰC & THÁNG
# ────────────────────────────────────────────────────────
@router.get("/seasonal-calendar")
def get_seasonal_calendar(month: int = Query(...), region: str = Query(...)):
    """Trả về lịch trồng trọt cho vùng miền và tháng cụ thể"""
    region_data = SEASONAL_DATA.get(region, {})
    month_data = region_data.get(month, None)
    
    # Fallback về Miền Bắc nếu trống dữ liệu vùng miền
    if not month_data:
        month_data = SEASONAL_DATA["Bắc"].get(month, {
            "weather": "Nắng nhẹ ôn hòa.",
            "plant": ["Đậu nành", "Rau thơm"],
            "care": ["Làm đất tơi", "Tưới gốc giữ ẩm"],
            "harvest": ["Rau ăn lá"],
            "warning": "Theo dõi mật độ côn trùng chích hút hại rễ."
        })
        
    return {
        "success": True,
        "data": {
            "region_title": f"Lịch vụ mùa tại Miền {region} - Tháng {month}",
            "weather_summary": month_data.get("weather"),
            "plants": month_data.get("plant"),
            "care": month_data.get("care"),
            "harvest": month_data.get("harvest"),
            "warning": month_data.get("warning")
        }
    }

# ────────────────────────────────────────────────────────
# 7. API: BẢN ĐỒ NÔNG NGHIỆP TƯƠNG TÁC
# ────────────────────────────────────────────────────────
@router.get("/map-data")
def get_map_data():
    """Dữ liệu thời tiết và khoanh vùng mật độ dịch bệnh phục vụ bản đồ"""
    # Fixed: removed stray bracket and list of diagnostics
    return {"success": True, "regions": MAP_REGIONS}