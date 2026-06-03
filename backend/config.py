"""
config.py
=========
Cấu hình trung tâm cho toàn bộ dự án.
Thay đổi tham số tại đây sẽ ảnh hưởng tất cả các file khác.
"""

from pathlib import Path

# ── Đường dẫn ──────────────────────────────────────────────
BASE_DIR      = Path(__file__).resolve().parent.parent # Trỏ ra thư mục gốc của dự án
DATA_DIR      = BASE_DIR / "data"
RAW_DIR       = BASE_DIR / "crop_dataset_raw"
SYNTHETIC_DIR = DATA_DIR / "synthetic"
TRAIN_DIR     = DATA_DIR / "train"
VAL_DIR       = DATA_DIR / "val"
TEST_DIR      = DATA_DIR / "test"
MODEL_DIR     = BASE_DIR / "models"
STATIC_DIR    = BASE_DIR / "static"
LOG_DIR       = BASE_DIR / "logs"
HISTORY_DIR   = BASE_DIR / "frontend" / "history"

import os
from dotenv import load_dotenv

# Load .env file
load_dotenv(BASE_DIR / ".env")

# ── Cấu hình Supabase ──────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") 
USE_SUPABASE = True
# ──────────────────────────────────────────────────────────

# Tạo thư mục nếu chưa có
for d in [MODEL_DIR, LOG_DIR, SYNTHETIC_DIR, HISTORY_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── Các loại cây lương thực ────────────────────────────────
CLASSES = [
    "rice_leaf", "rice_stalk", "rice_product",
    "corn_leaf", "corn_stalk", "corn_product",
    "wheat_leaf", "wheat_stalk", "wheat_product",
    "soybean_leaf", "soybean_stalk", "soybean_product",
    "sugarcane_leaf", "sugarcane_stalk", "sugarcane_product",
    "sweet_potato_leaf", "sweet_potato_stalk", "sweet_potato_product",
    "cassava_leaf", "cassava_stalk", "cassava_product",
    "potato_leaf", "potato_stalk", "potato_product",
    "barley_leaf", "barley_stalk",
    "peanut_leaf", "peanut_stalk", "peanut_product",
    "millet_leaf", "millet_stalk", "millet_product",
    "sorghum_leaf", "sorghum_stalk", "sorghum_product",
    "oat_leaf", "oat_stalk", "oat_product",
]

CLASS_INFO = {
    "rice_leaf":      {"vi": "Lá Lúa",       "en": "Rice Leaf",      "emoji": "🌿"},
    "rice_stalk":     {"vi": "Thân Lúa/Rơm", "en": "Rice Stalk",     "emoji": "🌾"},
    "rice_product":   {"vi": "Hạt/Bông Lúa", "en": "Rice Product",   "emoji": "🍚"},
    
    "corn_leaf":      {"vi": "Lá Ngô",       "en": "Corn Leaf",      "emoji": "🌿"},
    "corn_stalk":     {"vi": "Thân Ngô",     "en": "Corn Stalk",     "emoji": "🎋"},
    "corn_product":   {"vi": "Bắp Ngô",      "en": "Corn Product",   "emoji": "🌽"},
    
    "wheat_leaf":     {"vi": "Lá Lúa mì",    "en": "Wheat Leaf",     "emoji": "🌿"},
    "wheat_stalk":    {"vi": "Thân Lúa mì",  "en": "Wheat Stalk",    "emoji": "🌾"},
    "wheat_product":  {"vi": "Bông Lúa mì",  "en": "Wheat Product",  "emoji": "🍞"},
    
    "soybean_leaf":   {"vi": "Lá Đậu nành",  "en": "Soybean Leaf",   "emoji": "🌿"},
    "soybean_stalk":  {"vi": "Thân Đậu nành","en": "Soybean Stalk",  "emoji": "🌿"},
    "soybean_product":{"vi": "Hạt Đậu nành", "en": "Soybean Product","emoji": "🌱"},
    
    "sugarcane_leaf": {"vi": "Lá Mía",       "en": "Sugarcane Leaf", "emoji": "🌿"},
    "sugarcane_stalk":{"vi": "Thân Mía",     "en": "Sugarcane Stalk","emoji": "🎋"},
    "sugarcane_product":{"vi": "Khúc Mía",   "en": "Sugarcane Product","emoji": "🎋"},
    
    "sweet_potato_leaf": {"vi": "Lá Khoai lang", "en": "Sweet Potato Leaf", "emoji": "🌿"},
    "sweet_potato_stalk":{"vi": "Dây Khoai lang","en": "Sweet Potato Stalk","emoji": "🌿"},
    "sweet_potato_product":{"vi": "Củ Khoai lang","en": "Sweet Potato Tuber","emoji": "🍠"},
    
    "cassava_leaf":   {"vi": "Lá Sắn",       "en": "Cassava Leaf",   "emoji": "🌿"},
    "cassava_stalk":  {"vi": "Thân Sắn",     "en": "Cassava Stalk",  "emoji": "🎋"},
    "cassava_product":{"vi": "Củ Sắn",       "en": "Cassava Tuber",  "emoji": "🥔"},
    
    "potato_leaf":    {"vi": "Lá Khoai tây", "en": "Potato Leaf",    "emoji": "🌿"},
    "potato_stalk":   {"vi": "Thân Khoai tây","en": "Potato Stalk",  "emoji": "🌿"},
    "potato_product": {"vi": "Củ Khoai tây", "en": "Potato Tuber",   "emoji": "🥔"},
    
    "barley_leaf":      {"vi": "Lá lúa mạch",       "en": "Barley Leaf",      "emoji": "🌿"},
    "barley_stalk":     {"vi": "Lúa mạch",          "en": "Barley Stalk",     "emoji": "🌾"},
    
    "peanut_leaf":      {"vi": "Lá Đậu phộng",       "en": "Peanut Leaf",      "emoji": "🌿"},
    "peanut_stalk":     {"vi": "Dây Đậu phộng",      "en": "Peanut Stalk",     "emoji": "🌿"},
    "peanut_product":   {"vi": "Củ/Quả Đậu phộng",   "en": "Peanut Tuber",     "emoji": "🥜"},
    
    "millet_leaf":      {"vi": "Lá Kê",              "en": "Millet Leaf",      "emoji": "🌿"},
    "millet_stalk":     {"vi": "Thân Kê",             "en": "Millet Stalk",     "emoji": "🌾"},
    "millet_product":   {"vi": "Bông Kê",            "en": "Millet Product",   "emoji": "🌾"},
    
    "sorghum_leaf":     {"vi": "Lá Cao lương",       "en": "Sorghum Leaf",     "emoji": "🌿"},
    "sorghum_stalk":    {"vi": "Thân Cao lương",     "en": "Sorghum Stalk",    "emoji": "🎋"},
    "sorghum_product":  {"vi": "Bông Cao lương",     "en": "Sorghum Product",  "emoji": "🌾"},
    
    "oat_leaf":         {"vi": "Lá Yến mạch",        "en": "Oat Leaf",         "emoji": "🌿"},
    "oat_stalk":        {"vi": "Thân Yến mạch",       "en": "Oat Stalk",        "emoji": "🌾"},
    "oat_product":      {"vi": "Bông Yến mạch",       "en": "Oat Product",      "emoji": "🥣"},
}

# ── Thông tin chi tiết từng loại cây ──────────────────────
CROP_DETAILS = {
    "rice": {
        "vi": "Lúa",
        "ten_khoa_hoc": "Oryza sativa / Oryza glaberrima",
        "bo": "Poales",
        "ho": "Poaceae",
        "chi": "Oryza",
        "loai": "O. sativa",
        "mo_ta": "Lúa là cây lương thực thân thảo, mọc thành khóm. Hạt lúa (thóc) sau khi xay xát cho ra gạo - nguồn cung cấp tinh bột chính cho hơn một nửa dân số thế giới.",
        "thuoc_tinh": {
            "loai_cay": "Cây nông nghiệp hàng năm",
            "chieu_cao": "1 - 1.8m",
            "moi_truong": "Ruộng ngập nước (lúa nước) hoặc sườn đồi cạn",
            "thoi_gian": "3 - 6 tháng",
            "mau_la": "Xanh mướt, chuyển vàng khi chín",
            "mau_dac_trung": "Hoa trắng/lục nhạt, Thân xanh"
        },
        "dieu_kien": {
            "nuoc": "Chịu úng tốt nhưng chịu hạn kém (đối với lúa nước). Đòi hỏi quản lý nước nghiêm ngặt.",
            "anh_sang": "Nắng toàn phần.",
            "dat": "Đất phù sa, đất thịt pha sét giữ nước tốt."
        },
        "sau_benh": [
            {"ten": "Rầy nâu", "mo_ta": "Hút nhựa cây làm lúa khô héo, lây truyền bệnh."},
            {"ten": "Sâu cuốn lá", "mo_ta": "Sâu non nhả tơ cuốn dọc lá lại để trú ẩn và ăn biểu bì lá."},
            {"ten": "Sâu đục thân", "mo_ta": "Đục vào lóng, làm khô nải hoặc bông bạc."},
            {"ten": "Nhện gié", "mo_ta": "Gây hại trên bẹ lá, làm thối bẹ, hạt lép."}
        ],
        "cau_chuyen": "Từ 'rice' trong tiếng Anh bắt nguồn từ 'oryza' trong tiếng Latin/Hy Lạp, có gốc từ tiếng Tamil cổ 'arisi'. Tại Việt Nam, 'lúa' là từ thuần Việt gắn liền với nền văn minh lúa nước lâu đời.",
        "bieu_tuong": "Tượng trưng cho sự no đủ, thịnh vượng, sinh sôi nảy nở và là linh hồn của nền văn hóa Á Đông.",
        "su_that": "Có tới hơn 40,000 giống lúa khác nhau trên thế giới.",
        "meo_chuyen_gia": "Giữ mực nước trong ruộng ổn định khoảng 3-5cm ở giai đoạn lúa đẻ nhánh để tối ưu hóa năng suất, sau đó rút cạn dần khi lúa chín để dễ thu hoạch.",
        "ung_dung": "Nấu cơm, cháo, làm bún, phở, bánh mứt, nấu rượu. Rơm rạ dùng làm thức ăn gia súc, ủ phân hoặc lợp nhà.",
        "gallery": [
            "https://images.unsplash.com/photo-1595856401064-2d5e238030ae?q=80&w=600&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1596767678586-7a71f021e9ec?q=80&w=600&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?q=80&w=600&auto=format&fit=crop"
        ]
    },
    "corn": {
        "vi": "Ngô (Bắp)",
        "ten_khoa_hoc": "Zea mays",
        "bo": "Poales",
        "ho": "Poaceae",
        "chi": "Zea",
        "loai": "Z. mays",
        "mo_ta": "Cây thân thảo cao lớn, có nguồn gốc từ châu Mỹ. Hạt ngô mọc thành lõi (bắp) được bọc trong các lớp áo lá.",
        "thuoc_tinh": {
            "loai_cay": "Cây hàng năm",
            "chieu_cao": "2 - 3m",
            "moi_truong": "Vùng đất tơi xốp, thoát nước tốt, khí hậu ấm áp",
            "thoi_gian": "3 - 4 tháng",
            "mau_la": "Xanh đậm, to bản, mép gợn sóng",
            "mau_dac_trung": "Cờ ngô vàng/tím, Râu ngô mượt"
        },
        "dieu_kien": {
            "nuoc": "Chịu hạn khá, không chịu được ngập úng.",
            "anh_sang": "Nắng toàn phần (6-8 tiếng/ngày).",
            "dat": "Vùng đất tơi xốp, thoát nước tốt."
        },
        "sau_benh": [
            {"ten": "Sâu keo mùa thu", "mo_ta": "Cắn phá lá, ăn sâu vào nõn ngô."},
            {"ten": "Rệp cờ", "mo_ta": "Chích hút nhựa ở phần cờ ngô làm giảm khả năng thụ phấn."},
            {"ten": "Sâu đục thân ngô", "mo_ta": "Sâu đục rỗng thân làm cây gãy gập."},
            {"ten": "Sâu xám", "mo_ta": "Cắn đứt thân cây con mới mọc."}
        ],
        "cau_chuyen": "Từ 'maize' xuất phát từ 'mahiz' trong ngôn ngữ Taino. Ở Việt Nam gọi là 'ngô' vì giống cây này được mang về từ phương Bắc thời nhà Minh, miền Nam gọi 'bắp' vì hình dáng cuộn lại.",
        "bieu_tuong": "Tượng trưng cho sự sống, sự tái sinh và mặt trời trong văn hóa của người bản địa châu Mỹ (Maya, Aztec, Inca).",
        "su_that": "Một bắp ngô trung bình có khoảng 800 hạt, luôn được xếp thành số hàng chẵn (thường là 16 hàng).",
        "meo_chuyen_gia": "Hãy trồng ngô thành các khối vuông thay vì trồng theo một hàng dọc dài. Ngô thụ phấn nhờ gió, trồng theo khối giúp tăng tỷ lệ thụ phấn, cho bắp hạt đều đặn hơn.",
        "ung_dung": "Ăn trực tiếp (luộc, nướng), nghiền bột, chiết xuất dầu, làm thức ăn chăn nuôi, sản xuất cồn sinh học (ethanol).",
        "gallery": [
            "https://images.unsplash.com/photo-1598285517243-7fba022d4a52?q=80&w=600&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1563214820-20ce66bbdb25?q=80&w=600&auto=format&fit=crop"
        ]
    },
    "wheat": {
        "vi": "Lúa mì",
        "ten_khoa_hoc": "Triticum aestivum",
        "bo": "Poales",
        "ho": "Poaceae",
        "chi": "Triticum",
        "loai": "T. aestivum",
        "mo_ta": "Một loại ngũ cốc quan trọng có nguồn gốc từ khu vực Lưỡi liềm Màu mỡ (Trung Đông), là thành phần chính làm ra bánh mì và các loại mì sợi.",
        "thuoc_tinh": {
            "loai_cay": "Cây hàng năm (mùa đông hoặc mùa xuân)",
            "chieu_cao": "0.6 - 1.2m",
            "moi_truong": "Khí hậu ôn đới",
            "thoi_gian": "100-130 ngày (xuân) hoặc 8-9 tháng (đông)",
            "mau_la": "Xanh xám",
            "mau_dac_trung": "Vàng rơm khi chín"
        },
        "dieu_kien": {
            "nuoc": "Lúa mì mùa đông chịu lạnh xuất sắc, chịu hạn tốt hơn lúa nước.",
            "anh_sang": "Nắng toàn phần.",
            "dat": "Đất pha sét hoặc phù sa màu mỡ."
        },
        "sau_benh": [
            {"ten": "Rệp lúa mì", "mo_ta": "Chích hút nhựa và lây truyền virus."},
            {"ten": "Bọ xít", "mo_ta": "Làm lép hạt và giảm chất lượng tinh bột."},
            {"ten": "Ruồi Hesse", "mo_ta": "Ấu trùng ăn thân lúa, làm thân yếu và dễ gãy."},
            {"ten": "Tuyến trùng", "mo_ta": "Gây nốt sưng rễ, cản trở hút dinh dưỡng."}
        ],
        "cau_chuyen": "Từ 'wheat' trong tiếng Anh có nguồn gốc từ tiếng Đức cổ 'hweiti', có nghĩa là 'thứ màu trắng' (chỉ bột mì trắng).",
        "bieu_tuong": "Tượng trưng cho thu hoạch, sự tái sinh, sự dồi dào và của cải (hình ảnh bông lúa mì thường xuất hiện trên quốc huy của nhiều quốc gia).",
        "su_that": "Lúa mì là cây trồng được thu hoạch trên một diện tích đất đai lớn hơn bất kỳ loại cây thương mại nào khác trên thế giới.",
        "meo_chuyen_gia": "Tránh tưới nước lên lá trong điều kiện độ ẩm cao để ngăn ngừa nấm rỉ sắt - kẻ thù số 1 của lúa mì.",
        "ung_dung": "Làm bột mì (bánh mì, bánh ngọt, mì sợi, pasta), nấu bia, lên men rượu vodka.",
        "gallery": [
            "https://images.unsplash.com/photo-1501430654243-c934cec2e1c0?q=80&w=600&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1542318721-70bf813b2ce2?q=80&w=600&auto=format&fit=crop"
        ]
    },
    "soybean": {
        "vi": "Đậu nành (Đậu tương)",
        "ten_khoa_hoc": "Glycine max",
        "bo": "Fabales",
        "ho": "Fabaceae",
        "chi": "Glycine",
        "loai": "G. max",
        "mo_ta": "Cây họ đậu thân thảo có nguồn gốc từ Đông Á, nổi tiếng với hạt chứa lượng protein và dầu rất cao.",
        "thuoc_tinh": {
            "loai_cay": "Cây hàng năm",
            "chieu_cao": "0.5 - 1.5m",
            "moi_truong": "Khí hậu ấm áp",
            "thoi_gian": "3 - 5 tháng",
            "mau_la": "Xanh đậm, có lông tơ",
            "mau_dac_trung": "Hoa trắng/hồng/tím lợt"
        },
        "dieu_kien": {
            "nuoc": "Chịu hạn tương đối nhưng cực kỳ mẫn cảm với sương giá.",
            "anh_sang": "Nắng toàn phần.",
            "dat": "Cần đất tơi xốp, thoát nước tốt."
        },
        "sau_benh": [
            {"ten": "Bọ xít", "mo_ta": "Chích hút hạt non làm hạt xẹp, lép."},
            {"ten": "Sâu khoang", "mo_ta": "Ăn lá, để lại phần gân lá."},
            {"ten": "Rệp sáp", "mo_ta": "Hút nhựa làm héo ngọn non và quả đậu."},
            {"ten": "Ruồi đục thân", "mo_ta": "Ấu trùng đục vào thân làm chết cây con."}
        ],
        "cau_chuyen": "Bắt nguồn từ tiếng Nhật 'shoyu' (nước tương). Người phương Tây gọi là 'soy' vì ban đầu họ tiếp xúc với sản phẩm nước tương trước khi biết tới hạt đậu.",
        "bieu_tuong": "Đại diện cho sự nuôi dưỡng và sức khỏe dồi dào, là một trong năm loại hạt thiêng của Trung Quốc cổ đại.",
        "su_that": "Đậu nành chứa đầy đủ tất cả các axit amin thiết yếu, làm cho nó trở thành loại protein thực vật hiếm hoi 'hoàn chỉnh' như protein thịt động vật.",
        "meo_chuyen_gia": "Rễ đậu nành có các nốt sần chứa vi khuẩn Rhizobium giúp cố định đạm từ không khí. Không cần bón nhiều phân đạm hóa học vì sẽ làm cây lười tạo nốt sần, hãy bón lân và kali.",
        "ung_dung": "Làm đậu phụ, sữa đậu nành, nước tương, dầu ăn, thức ăn chăn nuôi giàu đạm, nguyên liệu công nghiệp (mực in sinh học, nhiên liệu).",
        "gallery": [
            "https://images.unsplash.com/photo-1590059344199-a3bf604cfbdf?q=80&w=600&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1627308595171-d0092ddde85d?q=80&w=600&auto=format&fit=crop"
        ]
    },
    "cassava": {
        "vi": "Sắn (Khoai mì)",
        "ten_khoa_hoc": "Manihot esculenta",
        "bo": "Malpighiales",
        "ho": "Euphorbiaceae",
        "chi": "Manihot",
        "loai": "M. esculenta",
        "mo_ta": "Cây thân gỗ nhỏ, mọc thành bụi, có nguồn gốc từ Nam Mỹ. Rễ cây phình to thành củ chứa đầy tinh bột.",
        "thuoc_tinh": {
            "loai_cay": "Cây bụi sống lâu năm",
            "chieu_cao": "1.5 - 3m",
            "moi_truong": "Vùng nhiệt đới, khí hậu khô cằn",
            "thoi_gian": "8 - 12 tháng",
            "mau_la": "Xanh đậm, xẻ thùy chân vịt sâu",
            "mau_dac_trung": "Thân xám bạc hoặc hơi đỏ"
        },
        "dieu_kien": {
            "nuoc": "Cực kỳ chịu hạn, sợ ngập úng.",
            "anh_sang": "Nắng toàn phần.",
            "dat": "Chịu được đất nghèo dinh dưỡng, chua, cằn cỗi."
        },
        "sau_benh": [
            {"ten": "Rệp sáp bột hồng", "mo_ta": "Bám thành mảng hút nhựa ngọn sắn, làm xoăn lá non."},
            {"ten": "Nhện đỏ", "mo_ta": "Chích hút mặt dưới lá trong điều kiện khô hạn làm lá rụng."},
            {"ten": "Bọ phấn trắng", "mo_ta": "Môi giới truyền bệnh khảm lá virus nguy hiểm."}
        ],
        "cau_chuyen": "'Cassava' xuất phát từ tiếng Taino 'caçabi' (nghĩa là bánh mì làm từ rễ cây).",
        "bieu_tuong": "Tượng trưng cho sự bền bỉ, sức sống kiên cường vươn lên trong gian khó (vì sống được ở nơi đất đai cằn cỗi nhất).",
        "su_that": "Củ và lá sắn sống chứa xyanua (độc tố mạnh). Nó phải được bóc vỏ, ngâm nước và nấu chín kỹ để loại bỏ độc tố trước khi ăn.",
        "meo_chuyen_gia": "Trồng bằng cách giâm cành (hom sắn). Cắm hom xiên góc 45 độ trên những vùng đất dốc sẽ giúp củ phát triển tốt và dễ nhổ hơn.",
        "ung_dung": "Luộc ăn trực tiếp, làm bột sắn (bột năng, tapioca), thức ăn gia súc, sản xuất cồn sinh học, làm mì chính (bột ngọt).",
        "gallery": [
            "https://plus.unsplash.com/premium_photo-1664303357876-0f04c62c954e?q=80&w=600&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1596767678586-7a71f021e9ec?q=80&w=600&auto=format&fit=crop"
        ]
    },
    "sweet_potato": {
        "vi": "Khoai lang",
        "ten_khoa_hoc": "Ipomoea batatas",
        "bo": "Solanales",
        "ho": "Convolvulaceae",
        "chi": "Ipomoea",
        "loai": "I. batatas",
        "mo_ta": "Cây thân leo/bò sát mặt đất, có nguồn gốc từ vùng nhiệt đới châu Mỹ, rễ phình to tạo thành củ ngọt có hình dáng đa dạng.",
        "thuoc_tinh": {
            "loai_cay": "Dây leo sống lâu năm",
            "chieu_cao": "Dây bò dài 1 - 5m",
            "moi_truong": "Khí hậu nhiệt đới/cận nhiệt ôn hòa",
            "thoi_gian": "3 - 5 tháng",
            "mau_la": "Xanh hoặc tía, hình tim hoặc xẻ thùy",
            "mau_dac_trung": "Hoa hình phễu màu trắng pha tím"
        },
        "dieu_kien": {
            "nuoc": "Chịu hạn tốt, sợ ngập úng và rét đậm.",
            "anh_sang": "Nắng toàn phần.",
            "dat": "Đất cát pha tơi xốp."
        },
        "sau_benh": [
            {"ten": "Sùng khoai lang (Bọ hà)", "mo_ta": "Ấu trùng đục củ sinh ra mùi hăng đắng khó chịu."},
            {"ten": "Sâu ăn lá", "mo_ta": "Gặm khuyết lá làm giảm quang hợp."},
            {"ten": "Rầy mềm", "mo_ta": "Chích hút nhựa ngọn non."}
        ],
        "cau_chuyen": "Từ 'batata' trong ngôn ngữ Taino là nguồn gốc của từ 'potato' trong tiếng Anh. Sau này để phân biệt, người ta thêm chữ 'sweet' (ngọt).",
        "bieu_tuong": "Tượng trưng cho sự khiêm tốn, giản dị và nguồn an ủi dưỡng nuôi trong thời kỳ khốn khó.",
        "su_that": "Dù tên tiếng Anh là 'sweet potato', nó không có họ hàng sinh học nào với khoai tây (potato), mà lại có họ hàng với hoa mười giờ/hoa bìm bìm.",
        "meo_chuyen_gia": "Đừng trồng khoai lang trên đất có quá nhiều nitơ (phân đạm), cây sẽ phát triển nhiều lá rậm rạp mà củ lại rất nhỏ và ít. Cần nhiều kali để củ phình to.",
        "ung_dung": "Củ luộc/nướng, chiên, làm bánh, mứt, lấy tinh bột. Ngọn và lá khoai lang non dùng làm rau ăn rất tốt cho tiêu hóa.",
        "gallery": [
            "https://images.unsplash.com/photo-1596767678586-7a71f021e9ec?q=80&w=600&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1601648764658-cf37e8c89b70?q=80&w=600&auto=format&fit=crop"
        ]
    },
    "sugarcane": {
        "vi": "Mía",
        "ten_khoa_hoc": "Saccharum officinarum",
        "bo": "Poales",
        "ho": "Poaceae",
        "chi": "Saccharum",
        "loai": "S. officinarum",
        "mo_ta": "Cây thân thảo khổng lồ, trông giống cây tre, chứa lượng lớn đường saccarozo trong thân. Nguồn gốc từ Nam Á và Đông Nam Á.",
        "thuoc_tinh": {
            "loai_cay": "Cây lâu năm",
            "chieu_cao": "2 - 6m",
            "moi_truong": "Vùng nhiệt đới, khí hậu nóng ẩm",
            "thoi_gian": "10 - 18 tháng",
            "mau_la": "Xanh mướt, thuôn dài, mép có răng cưa sắc",
            "mau_dac_trung": "Thân chia thành nhiều lóng"
        },
        "dieu_kien": {
            "nuoc": "Chịu nhiệt rất giỏi, cần lượng nước dồi dào nhưng không chịu được đất úng bão hòa nước.",
            "anh_sang": "Nắng toàn phần gắt.",
            "dat": "Đất phì nhiêu."
        },
        "sau_benh": [
            {"ten": "Bọ hung đen", "mo_ta": "Ấu trùng (sùng đất) cắn rễ làm khô héo mầm mía non."},
            {"ten": "Sâu đục thân", "mo_ta": "Đục rỗng các lóng mía gây chết khô ngọn, thất thoát lượng đường lớn."},
            {"ten": "Rệp xơ bông trắng", "mo_ta": "Bám dày đặc dưới mặt lá, hút nhựa và tiết mật gây nấm muội đen."}
        ],
        "cau_chuyen": "Từ 'sugar' (đường) xuất phát từ tiếng Phạn 'śarkarā', nghĩa là đường sỏi/đường thô, phản ánh nguồn gốc của cây mía tại Ấn Độ cổ đại.",
        "bieu_tuong": "Tượng trưng cho sự ngọt ngào, niềm vui và tinh thần kết nối (được dùng nhiều trong các nghi lễ cúng bái ở châu Á).",
        "su_that": "Mía là một trong những loài thực vật quang hợp hiệu quả nhất trên hành tinh, chuyển đổi lên tới 2% năng lượng mặt trời thành sinh khối.",
        "meo_chuyen_gia": "Hãy lột bỏ bớt lá khô (đánh lá) ở phần gốc cây khi cây đang vươn lóng. Việc này giúp ruộng mía thông thoáng, giảm sâu bệnh và tập trung dinh dưỡng vào thân.",
        "ung_dung": "Ép lấy nước giải khát, tinh chế đường cát, mật đường. Bã mía dùng làm giấy, ván ép hoặc đốt phát điện. Lên men sản xuất rượu Rum và ethanol.",
        "gallery": [
            "https://images.unsplash.com/photo-1596767678586-7a71f021e9ec?q=80&w=600&auto=format&fit=crop",
            "https://plus.unsplash.com/premium_photo-1661596041680-48206d2c4e2f?q=80&w=600&auto=format&fit=crop"
        ]
    },
    "potato": {
        "vi": "Khoai tây",
        "ten_khoa_hoc": "Solanum tuberosum",
        "bo": "Solanales",
        "ho": "Solanaceae",
        "chi": "Solanum",
        "loai": "S. tuberosum",
        "mo_ta": "Cây thân thảo phát triển rễ thành củ ngầm chứa tinh bột, có nguồn gốc từ dãy Andes ở Nam Mỹ.",
        "thuoc_tinh": {
            "loai_cay": "Cây lâu năm (canh tác một năm)",
            "chieu_cao": "0.5 - 1m",
            "moi_truong": "Khí hậu ôn đới mát mẻ",
            "thoi_gian": "3 - 4 tháng",
            "mau_la": "Xanh sẫm, hơi nhám",
            "mau_dac_trung": "Hoa trắng/hồng/đỏ/xanh/tím"
        },
        "dieu_kien": {
            "nuoc": "Cần đất ẩm đều nhưng không sũng nước. Sũng nước làm củ thối nhanh chóng.",
            "anh_sang": "Nắng toàn phần (nhưng củ phải che nắng tuyệt đối).",
            "dat": "Khí hậu ôn đới mát mẻ, đất tơi xốp."
        },
        "sau_benh": [
            {"ten": "Bọ khoai tây Colorado", "mo_ta": "Thành trùng và ấu trùng ăn trụi lá khoai tây."},
            {"ten": "Bệnh mốc sương (Late blight)", "mo_ta": "Gây thối rữa lá và củ cực nhanh trong điều kiện ẩm."},
            {"ten": "Rệp sáp", "mo_ta": "Hút nhựa và truyền virus gây khảm lá."},
            {"ten": "Ruồi trắng", "mo_ta": "Chích hút mặt dưới lá làm cây còi cọc."}
        ],
        "cau_chuyen": "Bắt nguồn từ từ 'patata' trong tiếng Tây Ban Nha (sự kết hợp của 'batata' - khoai lang - và 'papa' - khoai tây trong tiếng Quechua).",
        "bieu_tuong": "Tượng trưng cho sự ấm áp, mộc mạc và thức ăn của sự sống (đặc biệt tại châu Âu sau khi nó chấm dứt các nạn đói lịch sử).",
        "su_that": "Khoai tây là loại rau củ đầu tiên được trồng trong không gian (trên Tàu con thoi Columbia năm 1995).",
        "meo_chuyen_gia": "Luôn vun luống đất cao lên quanh gốc khi cây lớn. Đảm bảo củ khoai không tiếp xúc ánh nắng vì sẽ sinh ra độc tố solanine.",
        "ung_dung": "Nấu ăn (chiên, nghiền, hầm, nướng), sản xuất tinh bột khoai tây, làm vodka.",
        "gallery": [
            "https://images.unsplash.com/photo-1518977676601-b53f82aba655?q=80&w=600&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1596767678586-7a71f021e9ec?q=80&w=600&auto=format&fit=crop"
        ]
    },
    "barley": {
        "vi": "Đại mạch",
        "ten_khoa_hoc": "Hordeum vulgare",
        "bo": "Poales",
        "ho": "Poaceae",
        "chi": "Hordeum",
        "loai": "H. vulgare",
        "mo_ta": "Đại mạch là một trong những ngũ cốc quan trọng nhất, gieo trồng sớm nhất trong lịch sử loài người và được sử dụng rộng rãi làm bia và thức ăn chăn nuôi.",
        "thuoc_tinh": {
            "loai_cay": "Cây hàng năm",
            "chieu_cao": "0.7 - 1.2m",
            "moi_truong": "Khí hậu ôn đới",
            "thoi_gian": "3 - 5 tháng",
            "mau_la": "Xanh nhạt, sọc bẹ rõ rệt",
            "mau_dac_trung": "Bông có râu dài xếp hai hàng"
        },
        "dieu_kien": {
            "nuoc": "Chịu hạn tốt, rất sợ úng rễ.",
            "anh_sang": "Nắng toàn phần.",
            "dat": "Đất cát pha thịt thoát nước tốt."
        },
        "sau_benh": [
            {"ten": "Rỉ sắt đại mạch", "mo_ta": "Lốm đốm vàng cam mặt lá."},
            {"ten": "Rệp cây", "mo_ta": "Hút bẹ non làm chùn ngọn."}
        ],
        "cau_chuyen": "Bản chất là nguồn gốc của bia và các sản phẩm lên men đầu tiên từ hơn 10,000 năm trước ở vùng Lưỡi liềm Màu mỡ.",
        "bieu_tuong": "Tượng trưng cho sự ấm no và khởi sinh mùa màng.",
        "su_that": "Là nguyên liệu bắt buộc của các dòng bia cao cấp.",
        "meo_chuyen_gia": "Thu hoạch khi độ ẩm hạt đạt dưới 14% để tránh nấm mốc làm giảm giá trị mạch nha.",
        "ung_dung": "Làm bia (malt), ngũ cốc ăn sáng, thức ăn gia súc chất lượng cao.",
        "gallery": []
    },
    "peanut": {
        "vi": "Đậu phộng (Lạc)",
        "ten_khoa_hoc": "Arachis hypogaea",
        "bo": "Fabales",
        "ho": "Fabaceae",
        "chi": "Arachis",
        "loai": "A. hypogaea",
        "mo_ta": "Loài cây họ đậu có điểm độc đáo là hoa sau khi thụ phấn sẽ cắm xuống đất để hình thành quả (củ lạc) dưới lòng đất.",
        "thuoc_tinh": {
            "loai_cay": "Cây hàng năm bụi thấp",
            "chieu_cao": "0.3 - 0.5m",
            "moi_truong": "Đất cát, khí hậu nhiệt đới và cận nhiệt đới ấm áp",
            "thoi_gian": "4 - 5 tháng",
            "mau_la": "Xanh sáng, lá kép hình lông chim",
            "mau_dac_trung": "Hoa màu vàng sáng nhỏ"
        },
        "dieu_kien": {
            "nuoc": "Cần lượng nước trung bình, đất giữ ẩm tốt nhưng không đọng nước.",
            "anh_sang": "Nắng toàn phần cực độ.",
            "dat": "Đất cát pha tơi xốp sâu để củ phát triển."
        },
        "sau_benh": [
            {"ten": "Sâu ăn lá lạc", "mo_ta": "Cắn khuyết mép lá."},
            {"ten": "Bệnh đốm lá trễ", "mo_ta": "Đốm nâu đen có quầng vàng làm rụng lá hàng loạt."}
        ],
        "cau_chuyen": "Có nguồn gốc từ Nam Mỹ, được các nhà thám hiểm Tây Ban Nha mang đi khắp thế giới.",
        "bieu_tuong": "Tượng trưng cho sự bền bỉ, phát triển âm thầm nhưng mang lại quả ngọt dồi dào.",
        "su_that": "Củ lạc thực tế là quả chứ không phải là rễ củ giống khoai.",
        "meo_chuyen_gia": "Hãy xới đất tơi xốp xung quanh gốc sau khi hoa tàn để giúp đâm tia cắm xuống đất dễ dàng hơn.",
        "ung_dung": "Ép dầu, ăn trực tiếp (luộc, rang), bơ đậu phộng, kẹo bánh.",
        "gallery": []
    },
    "millet": {
        "vi": "Kê",
        "ten_khoa_hoc": "Panicum miliaceum / Setaria italica",
        "bo": "Poales",
        "ho": "Poaceae",
        "chi": "Panicum",
        "loai": "P. miliaceum",
        "mo_ta": "Nhóm các cây lương thực hạt nhỏ cực kỳ dẻo dai, phát triển tốt ở những vùng khô hạn nghèo dinh dưỡng của châu Á và châu Phi.",
        "thuoc_tinh": {
            "loai_cay": "Cây hàng năm thân cỏ",
            "chieu_cao": "0.5 - 1.5m",
            "moi_truong": "Khí hậu khô cằn, bán hoang mạc",
            "thoi_gian": "2 - 3 tháng (rất nhanh)",
            "mau_la": "Xanh đậm, mép sắc lông mảnh",
            "mau_dac_trung": "Bông hạt nhỏ dày đặc như đuôi chồn"
        },
        "dieu_kien": {
            "nuoc": "Chịu hạn siêu việt, nhu cầu nước rất thấp.",
            "anh_sang": "Nắng toàn phần.",
            "dat": "Chấp nhận mọi loại đất nghèo nàn, đất cát cằn cỗi."
        },
        "sau_benh": [
            {"ten": "Bọ trĩ", "mo_ta": "Hút nhựa làm bạc lá."},
            {"ten": "Sâu đục bẹ", "mo_ta": "Làm héo khô bông."}
        ],
        "cau_chuyen": "Kê đã được thuần hóa tại Trung Quốc hơn 10,000 năm trước, trước cả khi trồng lúa nước rộng rãi.",
        "bieu_tuong": "Tượng trưng cho sự thanh đạm, tự cấp tự túc và kiên cường vượt qua nghịch cảnh thời tiết.",
        "su_that": "Hạt kê chứa lượng gluten bằng không (gluten-free), cực kỳ tốt cho hệ tiêu hóa.",
        "meo_chuyen_gia": "Thu hoạch ngay khi 80% bông chuyển màu vàng rơm để tránh chim ăn phá và hạt tự rụng xuống ruộng.",
        "ung_dung": "Nấu cháo, làm bánh, làm cồn lên men, thức ăn cho chim cảnh.",
        "gallery": []
    },
    "sorghum": {
        "vi": "Cao lương (Sắn mì)",
        "ten_khoa_hoc": "Sorghum bicolor",
        "bo": "Poales",
        "ho": "Poaceae",
        "chi": "Sorghum",
        "loai": "S. bicolor",
        "mo_ta": "Cây ngũ cốc cao lớn tương tự ngô nhưng bông hạt mọc ở ngọn, là nguồn lương thực quan trọng tại các vùng khô hạn.",
        "thuoc_tinh": {
            "loai_cay": "Cây cỏ lớn hàng năm",
            "chieu_cao": "1.5 - 4m (rất cao)",
            "moi_truong": "Vùng nhiệt đới và cận nhiệt đới khô hạn",
            "thoi_gian": "3 - 5 tháng",
            "mau_la": "Xanh mốc có lớp sáp bảo vệ",
            "mau_dac_trung": "Chùm bông hạt tròn lớn mọc thẳng đứng trên ngọn"
        },
        "dieu_kien": {
            "nuoc": "Chịu hạn và nóng cực kỳ tốt nhờ lớp sáp bọc thân lá.",
            "anh_sang": "Nắng gắt toàn phần.",
            "dat": "Phát triển tốt trên đất sét nặng hoặc đất kiềm nhẹ."
        },
        "sau_benh": [
            {"ten": "Ruồi đục ngọn cao lương", "mo_ta": "Làm thối chết đọt non."},
            {"ten": "Sâu đục bông", "mo_ta": "Ăn phá hạt giai đoạn ngậm sữa."}
        ],
        "cau_chuyen": "Có nguồn gốc từ Đông Phi, sau đó theo con đường tơ lụa du nhập sâu vào châu Á.",
        "bieu_tuong": "Bông cao lương đỏ thẫm tượng trưng cho sự thu hoạch dồi dào và mùa màng bội thu.",
        "su_that": "Cao lương có khả năng ngủ đông tạm thời khi hạn hán và hồi sinh nhanh chóng khi có mưa lại.",
        "meo_chuyen_gia": "Chú ý lượng xyanua tự nhiên ở cây non. Chỉ cho gia súc ăn khi cây đạt chiều cao trên 60cm để đảm bảo an toàn.",
        "ung_dung": "Làm rượu (Rượu Mao Đài nổi tiếng của Trung Quốc), bột làm bánh, đường cao lương từ thân mía, nhiên liệu sinh học.",
        "gallery": []
    },
    "oat": {
        "vi": "Yến mạch",
        "ten_khoa_hoc": "Avena sativa",
        "bo": "Poales",
        "ho": "Poaceae",
        "chi": "Avena",
        "loai": "A. sativa",
        "mo_ta": "Loài ngũ cốc thích khí hậu mát ẩm ôn đới, nổi tiếng là thực phẩm vàng tốt cho sức khỏe tim mạch và làm đẹp.",
        "thuoc_tinh": {
            "loai_cay": "Cây hàng năm",
            "chieu_cao": "0.6 - 1.5m",
            "moi_truong": "Khí hậu lạnh mát, ẩm ướt",
            "thoi_gian": "3 - 4 tháng",
            "mau_la": "Xanh đậm, to bản, bẹ nhẵn",
            "mau_dac_trung": "Bông lúa dạng chùm rủ nhiều nhánh"
        },
        "dieu_kien": {
            "nuoc": "Cần độ ẩm đất cao, không chịu được hạn dài ngày.",
            "anh_sang": "Nắng toàn phần hoặc bán phần.",
            "dat": "Chịu được đất chua nghèo dinh dưỡng hơn lúa mì."
        },
        "sau_benh": [
            {"ten": "Tuyến trùng rễ", "mo_ta": "Làm cây lùn còi cọc."},
            {"ten": "Bệnh đốm sọc", "mo_ta": "Sọc đỏ nâu dọc gân lá."}
        ],
        "cau_chuyen": "Ban đầu bị người La Mã coi là cỏ dại phá hại lúa mì, sau đó được thuần hóa rộng rãi ở Bắc Âu.",
        "bieu_tuong": "Tượng trưng cho sự lành mạnh, thanh lọc và năng lượng bền bỉ.",
        "su_that": "Chứa chất Beta-glucan giúp giảm cholesterol xấu cực kỳ hiệu quả.",
        "meo_chuyen_gia": "Gieo trồng sớm vào đầu mùa xuân khi đất vừa tan băng để tận dụng độ ẩm tự nhiên tốt nhất.",
        "ung_dung": "Bột yến mạch ngũ cốc, làm sữa yến mạch, bánh quy, nguyên liệu mỹ phẩm dưỡng da.",
        "gallery": []
    }
}


NUM_CLASSES = len(CLASSES)

# ── Tham số ảnh ────────────────────────────────────────────
IMG_SIZE        = (384, 384)   # Tăng lên 384 cho EfficientNetV2-S để khớp model Colab
IMG_CHANNELS    = 3
INPUT_SHAPE     = (*IMG_SIZE, IMG_CHANNELS)

# ── Tham số huấn luyện ─────────────────────────────────────
BATCH_SIZE      = 12           # Giảm batch size vì mô hình V2-S và ảnh 380x380 tốn nhiều VRAM hơn
EPOCHS_FROZEN   = 15           # Tăng thời gian khởi đầu
EPOCHS_FINETUNE = 40           # Huấn luyện chuyên sâu để đạt >90%
LEARNING_RATE   = 1e-3
FINETUNE_LR     = 1e-5         # Fine-tune chậm và chắc
DROPOUT_RATE    = 0.5          # Tăng Dropout để chống học vẹt (Overfitting) khi chụp ngoài đồng
UNFREEZE_LAYERS = 100          # Mở sâu hơn vào backbone


# ── Tham số dataset ────────────────────────────────────────
TRAIN_RATIO     = 0.70
VAL_RATIO       = 0.15
TEST_RATIO      = 0.15
RANDOM_SEED     = 42
MIN_IMAGES      = 50           # Tối thiểu ảnh mỗi class

# -- Advanced Preprocessing ----------------------------------
USE_CLAHE       = True         # Cân bằng tương phản cho ảnh bị lóa màn hình
USE_DENOISE     = True         # Khử nhiễu Moiré (vân sọc)
PREPROCESS_MODE = "advanced"   # Chế độ xử lý ảnh nâng cao

# -- Early stopping -----------------------------------------
PATIENCE        = 10
MIN_DELTA       = 1e-4

# ── Model ──────────────────────────────────────────────────
MODEL_NAME      = "crop_super_v2s" # Đặt tên mới cho Siêu não bộ
BEST_MODEL_PATH = MODEL_DIR / f"{MODEL_NAME}_best.keras"
LAST_MODEL_PATH = MODEL_DIR / f"{MODEL_NAME}_last.keras"
HISTORY_PATH    = MODEL_DIR / "training_history.json"

# ── Streamlit app ──────────────────────────────────────────
APP_TITLE       = "Nhận Diện Cây Lương Thực"
APP_ICON        = "🌾"
MAX_UPLOAD_MB   = 10

# ── Dữ liệu Điều trị Chuyên gia ──────────────────────────────
TREATMENT_PROTOCOLS = {
    "Bệnh Đạo Ôn": {
        "title": "Phác đồ Điều trị Bệnh Đạo Ôn",
        "emergency": "Ngưng bón phân đạm ngay lập tức.",
        "chemical": "Phun các loại thuốc chứa hoạt chất Tricyclazole hoặc Fenoxanil.",
        "biological": "Sử dụng chế phẩm Trichoderma để đối kháng nấm."
    },
    "Bệnh Rầy Nâu": {
        "title": "Xử lý Rầy Nâu hại lúa",
        "emergency": "Tháo nước vào ruộng để rầy leo lên cao.",
        "chemical": "Sử dụng thuốc chứa hoạt chất Pymetrozine hoặc Dinotefuran.",
        "biological": "Bảo vệ các loài thiên địch như nhện, bọ xít mù xanh."
    },
    "Sâu Keo Mùa Thu": {
        "title": "Diệt Sâu Keo Mùa Thu trên Ngô",
        "emergency": "Ngắt bỏ ổ trứng và sâu non tập trung.",
        "chemical": "Spinetoram (Radient) hoặc Emamectin benzoate.",
        "biological": "Sử dụng nấm ký sinh Beauveria hoặc vi khuẩn Bacillus thuringiensis (Bt)."
    },
    "Bệnh Rỉ sắt Ngô": {
        "title": "Trị Bệnh Rỉ sắt trên Ngô",
        "emergency": "Tỉa bỏ lá bệnh nặng để thông thoáng.",
        "chemical": "Phun thuốc có gốc đồng hoặc hoạt chất Azoxystrobin + Difenoconazole.",
        "biological": "Tăng cường bón phân Kali để tăng sức đề kháng."
    },
    # Thêm các loại khác tương tự...
}
