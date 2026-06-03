"""
farming_guides.py
=================
Dữ liệu hướng dẫn nông nghiệp chi tiết cho từng cây lương thực.
Bao gồm: Kỹ thuật trồng, chăm sóc, bón phân, thu hoạch, bảo quản.
"""

FARMING_GUIDES = {
    "rice": {
        "growing": {
            "title": "Kỹ thuật trồng Lúa",
            "steps": [
                "**Chọn giống:** IR64, IR50404, Jasmine85, OM5451 tùy vùng. Ngâm hạt 24h trong nước ấm 54°C, ủ 24-36h đến khi nứt nanh.",
                "**Làm đất:** Cày bừa kỹ 2 lần, bón lót phân chuồng hoai 8-10 tấn/ha. San phẳng mặt ruộng, giữ mực nước 3-5cm.",
                "**Gieo sạ:** Sạ lan 100-120 kg/ha hoặc cấy mạ 2-3 tép/khóm, khoảng cách 20x20cm. Thời vụ: Đông Xuân (T11-T12), Hè Thu (T5-T6).",
                "**Mật độ:** Sạ thưa 80-100 kg/ha cho năng suất tốt nhất, tránh sạ dày gây sâu bệnh.",
            ]
        },
        "care": {
            "title": "Chăm sóc Lúa",
            "steps": [
                "**Quản lý nước:** Giữ mực nước 3-5cm giai đoạn đẻ nhánh. Rút cạn phơi ruộng 5-7 ngày cuối đẻ nhánh. Tưới lại khi lúa làm đòng.",
                "**Làm cỏ:** Dặm tỉa lúa sau gieo 7-10 ngày. Phun thuốc trừ cỏ tiền nảy mầm 1-3 ngày sau sạ.",
                "**Theo dõi:** Kiểm tra ruộng hàng tuần, phát hiện sớm sâu bệnh. Chú ý rầy nâu, sâu cuốn lá, bệnh đạo ôn.",
            ]
        },
        "fertilizer": {
            "title": "Bón phân cho Lúa",
            "steps": [
                "**Bón lót:** Trước khi gieo: 300-500kg vôi/ha + toàn bộ phân lân (400kg Super lân/ha).",
                "**Bón thúc 1 (7-10 ngày):** 1/3 lượng đạm Urê (50kg/ha) + 1/2 Kali (30kg KCl/ha).",
                "**Bón thúc 2 (20-25 ngày):** 1/3 lượng đạm (50kg Urê/ha) khi lúa đẻ nhánh rộ.",
                "**Bón đón đòng (40-45 ngày):** 1/3 đạm còn lại + 1/2 Kali còn lại. KHÔNG bón đạm sau trỗ.",
                "**Nguyên tắc:** Bón cân đối NPK, không thừa đạm (dễ bị đạo ôn, bạc lá). Công thức: 100N - 60P₂O₅ - 60K₂O kg/ha.",
            ]
        },
        "harvest": {
            "title": "Thu hoạch Lúa",
            "signs": [
                "**Màu sắc:** 85-90% hạt trên bông chuyển sang màu vàng rơm, cuống bông cong xuống.",
                "**Hạt lúa:** Bóp hạt thấy cứng, cắn hạt giòn, không còn sữa bên trong.",
                "**Lá:** Lá đòng (lá cuối cùng) chuyển vàng, 2-3 lá dưới đã khô.",
                "**Thời gian:** Sau trỗ 28-32 ngày (lúa ngắn ngày) hoặc 30-35 ngày (lúa dài ngày).",
                "**Độ ẩm hạt:** Khoảng 20-22% khi thu. Thu sáng sớm hoặc chiều mát tránh rụng hạt.",
            ],
            "storage": "Phơi/sấy đến độ ẩm 14%, bảo quản nơi khô ráo, thoáng mát. Kê cao cách nền 20cm, tránh ẩm mốc."
        }
    },
    "corn": {
        "growing": {
            "title": "Kỹ thuật trồng Ngô",
            "steps": [
                "**Chọn giống:** NK67, CP888, DK9901 (lai), hoặc ngô nếp địa phương. Xử lý hạt bằng thuốc trừ nấm trước gieo.",
                "**Làm đất:** Cày sâu 20-25cm, bừa nhỏ, lên luống cao 15-20cm (đất trũng). Bón lót phân chuồng 8-10 tấn/ha.",
                "**Gieo hạt:** 2 hạt/hốc, sâu 3-5cm. Khoảng cách 70x25cm (mật độ 5.7 vạn cây/ha). Tỉa giữ 1 cây/hốc khi 3-4 lá.",
                "**Thời vụ:** Xuân (T2-T3), Hè Thu (T6-T7), Đông (T9-T10 miền Bắc).",
            ]
        },
        "care": {
            "title": "Chăm sóc Ngô",
            "steps": [
                "**Tưới nước:** Tưới đủ ẩm giai đoạn trỗ cờ - phun râu (rất quan trọng). Tuyệt đối không để ngập úng.",
                "**Vun gốc:** Xới xáo + vun gốc lần 1 khi 3-4 lá. Vun cao lần 2 khi 7-9 lá giúp cây chống đổ.",
                "**Làm cỏ:** Kết hợp vun gốc. Hoặc phun thuốc trừ cỏ tiền nảy mầm ngay sau gieo.",
                "**Trồng khối:** Trồng thành khối vuông (không 1 hàng dài) để tăng tỷ lệ thụ phấn nhờ gió.",
            ]
        },
        "fertilizer": {
            "title": "Bón phân cho Ngô",
            "steps": [
                "**Bón lót:** Toàn bộ phân chuồng + lân + 1/3 đạm + 1/3 kali.",
                "**Bón thúc 1 (3-4 lá):** 1/3 đạm, kết hợp vun gốc lần 1.",
                "**Bón thúc 2 (7-9 lá):** 1/3 đạm + 2/3 kali còn lại, vun gốc cao.",
                "**Công thức:** 150N - 90P₂O₅ - 80K₂O kg/ha. Bón cách gốc 10cm, lấp đất.",
            ]
        },
        "harvest": {
            "title": "Thu hoạch Ngô",
            "signs": [
                "**Lá bi (áo bắp):** Chuyển vàng khô, tách mở ra.",
                "**Râu ngô:** Khô đen hoàn toàn.",
                "**Hạt ngô:** Bấm móng tay vào hạt — cứng, không lõm. Xuất hiện chấm đen ở đáy hạt (black layer).",
                "**Thân cây:** Lá dưới khô, thân bắt đầu ngả vàng.",
                "**Thời gian:** 90-120 ngày sau gieo tùy giống. Độ ẩm hạt đạt 25-30% khi thu.",
            ],
            "storage": "Bẻ bắp, bóc vỏ, phơi nắng 3-5 ngày. Tách hạt khi ẩm độ 13-14%. Bảo quản nơi khô, tránh mọt."
        }
    },
    "wheat": {
        "growing": {
            "title": "Kỹ thuật trồng Lúa mì",
            "steps": [
                "**Chọn giống:** Giống phù hợp khí hậu Việt Nam (vùng Tây Bắc). Xử lý hạt bằng thuốc trừ nấm.",
                "**Làm đất:** Cày sâu 15-20cm, bừa nhỏ, san phẳng. Đất tơi xốp, thoát nước tốt.",
                "**Gieo hạt:** Gieo vãi hoặc gieo hàng cách 20cm, sâu 3-4cm. Lượng giống: 120-150 kg/ha.",
                "**Thời vụ:** Vụ Đông (T10-T11), thu hoạch T3-T4 năm sau.",
            ]
        },
        "harvest": {
            "title": "Thu hoạch Lúa mì",
            "signs": [
                "**Bông lúa mì:** Chuyển vàng rơm hoàn toàn, cong xuống.",
                "**Hạt:** Cứng, cắn giòn, màu vàng sáng. Vỏ trấu tách rời hạt.",
                "**Thân cây:** Toàn bộ thân và lá khô vàng.",
                "**Thời gian:** 100-130 ngày (giống xuân) hoặc 8-9 tháng (giống đông).",
            ],
            "storage": "Phơi sấy đến ẩm độ 12-13%. Bảo quản kho khô, thoáng mát."
        }
    },
    "soybean": {
        "growing": {
            "title": "Kỹ thuật trồng Đậu nành",
            "steps": [
                "**Chọn giống:** DT84, ĐT26, MTĐ176 phù hợp Việt Nam. Xử lý hạt bằng vi khuẩn Rhizobium cố định đạm.",
                "**Làm đất:** Cày bừa kỹ, lên luống cao 15-20cm ở vùng hay ngập. Đất tơi xốp, pH 5.5-6.5.",
                "**Gieo hạt:** 2-3 hạt/hốc, sâu 3-4cm. Khoảng cách 40x10-15cm. Lượng giống: 60-70 kg/ha.",
                "**Thời vụ:** Xuân (T2-T3), Hè (T5-T6), Đông (T9-T10 sau lúa mùa).",
            ]
        },
        "harvest": {
            "title": "Thu hoạch Đậu nành",
            "signs": [
                "**Quả:** 90% quả chuyển vàng nâu, lắc nghe tiếng hạt kêu lóc cóc bên trong.",
                "**Lá:** Hầu hết lá rụng hết, chỉ còn thân khô.",
                "**Hạt:** Cứng, tách vỏ quả thấy hạt tách rời, màu vàng sáng.",
                "**Thời gian:** 85-100 ngày sau gieo. Thu khi trời nắng ráo, tránh mưa nứt quả.",
            ],
            "storage": "Phơi đập tách hạt, sấy đến ẩm 12%. Tránh ánh nắng trực tiếp lâu làm giảm chất lượng protein."
        }
    },
    "sugarcane": {
        "growing": {
            "title": "Kỹ thuật trồng Mía",
            "steps": [
                "**Chọn giống:** ROC22, K84-200, QĐ93-159 kháng bệnh. Lấy hom từ mía 7-8 tháng tuổi, mỗi hom 3 mắt mầm.",
                "**Làm đất:** Cày sâu 30-40cm, rạch hàng sâu 25-30cm. Bón lót phân chuồng 10-15 tấn/ha.",
                "**Trồng hom:** Đặt hom nằm ngang hoặc xiên 45° trong rãnh, lấp đất 5-7cm. Khoảng cách hàng 1-1.2m.",
                "**Thời vụ:** Đầu mùa mưa (T4-T5) hoặc cuối mùa mưa (T10-T11).",
            ]
        },
        "harvest": {
            "title": "Thu hoạch Mía",
            "signs": [
                "**Độ đường (CCS):** Đo bằng Brix kế, đạt 18-22° Brix là thu được.",
                "**Thân mía:** Lóng dài đều, vỏ bóng, chuyển màu vàng sáng/nâu nhạt.",
                "**Lá:** Lá ngọn ít, ngắn lại. Lá già khô rụng tự nhiên.",
                "**Nếm thử:** Nhai thấy ngọt thanh, nước trong. Mía chưa chín nước đục, vị chua.",
                "**Thời gian:** 10-14 tháng sau trồng. Thu vào mùa khô (T12-T4) cho chữ đường cao nhất.",
            ],
            "storage": "Chặt sát gốc, vận chuyển về nhà máy trong 24-48h. Mía để lâu giảm chữ đường nhanh."
        }
    },
    "sweet_potato": {
        "growing": {
            "title": "Kỹ thuật trồng Khoai lang",
            "steps": [
                "**Chọn giống:** Hoàng Long, Nhật tím, Nhật vàng. Lấy dây bánh tẻ (không non, không già) dài 25-30cm.",
                "**Làm đất:** Cày bừa kỹ, lên luống cao 30-40cm, rộng 1-1.2m. Đất cát pha tơi xốp là tốt nhất.",
                "**Trồng dây:** Cắm dây xiên 45° hoặc nằm ngang, chừa 2-3 đốt trên mặt đất. Khoảng cách 20-25cm/dây.",
                "**Thời vụ:** Đông (T9-T10 miền Bắc), quanh năm ở miền Nam.",
            ]
        },
        "harvest": {
            "title": "Thu hoạch Khoai lang",
            "signs": [
                "**Lá:** Lá chuyển vàng, dây bắt đầu héo úa tự nhiên.",
                "**Củ:** Đào thử 1-2 gốc, củ đạt kích thước mong muốn, vỏ củ nhẵn bóng.",
                "**Nứt đất:** Mặt luống nứt nẻ quanh gốc — dấu hiệu củ đã lớn.",
                "**Thời gian:** 3.5-5 tháng sau trồng tùy giống. Không để quá lâu — bọ hà sẽ đục củ.",
                "**Cách thu:** Đào nhẹ tay bằng cuốc/xẻng, tránh xước vỏ củ. Thu khi trời khô ráo.",
            ],
            "storage": "Phơi ráo vỏ 1-2 ngày trong bóng râm. Bảo quản nơi thoáng mát, không chồng đống."
        }
    },
    "cassava": {
        "growing": {
            "title": "Kỹ thuật trồng Sắn",
            "steps": [
                "**Chọn giống:** KM94, KM140, KM419 năng suất cao. Lấy hom thân bánh tẻ 7-10 tháng tuổi, dài 15-20cm.",
                "**Làm đất:** Cày sâu 20-25cm, bừa nhỏ. Lên luống cao nếu đất trũng.",
                "**Trồng hom:** Cắm xiên 45° hoặc nằm ngang, lấp 2/3 hom. Khoảng cách 80x80cm hoặc 100x60cm.",
                "**Thời vụ:** Đầu mùa mưa (T4-T5) là tốt nhất. Có thể trồng T1-T2 nếu đủ ẩm.",
            ]
        },
        "harvest": {
            "title": "Thu hoạch Sắn",
            "signs": [
                "**Lá:** Lá dưới rụng gần hết, chỉ còn chùm lá trên ngọn.",
                "**Thân:** Thân hóa gỗ hoàn toàn, vỏ xám bạc nứt nẻ.",
                "**Củ:** Đào thử — vỏ lụa bong tróc dễ, thịt củ trắng đặc.",
                "**Hàm lượng tinh bột:** Đạt 25-30% (đo bằng cân tỷ trọng). Củ nặng, chắc tay.",
                "**Thời gian:** 8-12 tháng sau trồng. Thu vào mùa khô cho tinh bột cao nhất.",
            ],
            "storage": "Chế biến ngay trong 24-48h sau thu (củ sắn nhanh hư). Bóc vỏ, ngâm nước, luộc chín kỹ loại bỏ HCN."
        }
    },
    "potato": {
        "growing": {
            "title": "Kỹ thuật trồng Khoai tây",
            "steps": [
                "**Chọn giống:** Atlantic (chế biến), Solara, Diamant (ăn tươi). Dùng củ giống 30-50g, đã ủ mọc mầm 1-2cm.",
                "**Làm đất:** Đất tơi xốp, thoát nước tốt. Lên luống cao 25-30cm, rộng 1.2m. pH đất 5.5-6.5.",
                "**Trồng củ:** Đặt củ mầm quay lên, sâu 8-10cm. Khoảng cách 30x60cm. Phủ rơm rạ 5-10cm giữ ẩm.",
                "**Thời vụ:** Vụ Đông miền Bắc (T10-T11). Đà Lạt trồng quanh năm.",
            ]
        },
        "harvest": {
            "title": "Thu hoạch Khoai tây",
            "signs": [
                "**Thân lá:** Thân cây ngã vàng, héo rũ xuống. Lá dưới khô.",
                "**Vỏ củ:** Đào thử — dùng ngón tay xoa nhẹ vỏ củ, nếu không tróc là đã chín.",
                "**Kích thước:** Củ đạt 4-6cm đường kính (tùy giống).",
                "**Thời gian:** 80-100 ngày sau trồng. Ngừng tưới 7-10 ngày trước thu.",
                "**Lưu ý:** Tuyệt đối không để củ tiếp xúc ánh nắng — sinh độc tố solanine (vỏ xanh).",
            ],
            "storage": "Phơi ráo vỏ trong bóng râm 2-3 ngày. Bảo quản 10-15°C, tối, thoáng. Không để chung với hành tỏi."
        }
    }
}
