"""
treatment_data.py
=================
Dữ liệu phác đồ điều trị chi tiết cho tất cả 8 loại cây trồng.
Bao gồm: Khẩn cấp, Hóa học, Sinh học, Phòng ngừa cho từng bệnh cụ thể.
"""

TREATMENT_DB = {
    # ═══════════════════════════════════════
    # LÚA (RICE)
    # ═══════════════════════════════════════
    "rice_dao_on": {
        "disease_vi": "Bệnh Đạo Ôn",
        "disease_en": "Rice Blast",
        "crop": "rice",
        "severity": "high",
        "emergency": [
            "Ngưng bón phân đạm ngay lập tức",
            "Tháo nước ruộng, giữ khô 3-5 ngày",
            "Cách ly vùng bệnh, không đi lại giữa ruộng bệnh và ruộng khỏe"
        ],
        "chemical": [
            {"name": "Tricyclazole 75WP", "dosage": "0.3-0.5 kg/ha", "interval": "7-10 ngày/lần", "note": "Phun khi phát hiện ổ bệnh đầu tiên"},
            {"name": "Isoprothiolane 40EC", "dosage": "1-1.5 lít/ha", "interval": "10 ngày/lần", "note": "Phun vào sáng sớm hoặc chiều mát"},
            {"name": "Fenoxanil 20WP", "dosage": "0.5 kg/ha", "interval": "7 ngày/lần", "note": "Hiệu quả với cả đạo ôn lá và cổ bông"}
        ],
        "biological": [
            "Phun Bacillus subtilis (Biobus) 2-3 lần/vụ phòng ngừa",
            "Bón vôi bột (CaO) 300-500 kg/ha trước gieo sạ",
            "Sử dụng nấm đối kháng Trichoderma bón vào đất"
        ],
        "prevention": [
            "Chọn giống kháng: IR64, IR50404, Jasmine85",
            "Không sạ dày quá 120 kg/ha",
            "Bón phân cân đối NPK (không thừa đạm)",
            "Luân canh lúa - màu để cắt nguồn bệnh"
        ]
    },
    "rice_bac_la": {
        "disease_vi": "Bệnh Bạc Lá",
        "disease_en": "Bacterial Leaf Blight",
        "crop": "rice",
        "severity": "high",
        "emergency": [
            "Tháo nước ruộng ngay, để khô 5-7 ngày",
            "Ngưng phun phân bón lá",
            "Thu gom và tiêu hủy lá bệnh nặng"
        ],
        "chemical": [
            {"name": "Bismerthiazol 40WP", "dosage": "0.5 kg/ha", "interval": "7 ngày/lần", "note": "Phun khi bệnh mới xuất hiện"},
            {"name": "Oxolinic acid 20WP", "dosage": "0.3 kg/ha", "interval": "10 ngày/lần", "note": "Kết hợp phun 2-3 lần liên tiếp"},
            {"name": "Kasugamycin 2SL", "dosage": "1.5 lít/ha", "interval": "7 ngày/lần", "note": "Kháng sinh thực vật hiệu quả cao"}
        ],
        "biological": [
            "Phun nano đồng sinh học 3-5 lần/vụ",
            "Bón Silic (SiO2) tăng sức đề kháng vách tế bào lá",
            "Dùng chế phẩm EM (vi sinh vật hữu hiệu) xử lý rơm rạ"
        ],
        "prevention": [
            "Không trồng quá dày (sạ thưa 80-100 kg/ha)",
            "Không bón thừa đạm giai đoạn đẻ nhánh",
            "Sử dụng giống kháng: IRBB21, TBR1",
            "Vệ sinh đồng ruộng sau thu hoạch"
        ]
    },
    "rice_ray_nau": {
        "disease_vi": "Rầy Nâu",
        "disease_en": "Brown Planthopper",
        "crop": "rice",
        "severity": "critical",
        "emergency": [
            "Bơm nước vào ruộng 5-7cm để rầy leo lên thân",
            "Phun thuốc trừ rầy khẩn cấp trong 24 giờ",
            "Cắm bẫy đèn bắt rầy trưởng thành bay về đêm"
        ],
        "chemical": [
            {"name": "Pymetrozine 50WG", "dosage": "0.15 kg/ha", "interval": "14 ngày/lần", "note": "An toàn cho thiên địch"},
            {"name": "Dinotefuran 20WP", "dosage": "0.15 kg/ha", "interval": "10 ngày/lần", "note": "Hiệu quả nhanh trong 2-3 giờ"},
            {"name": "Buprofezin 25WP", "dosage": "0.6 kg/ha", "interval": "14 ngày/lần", "note": "Ức chế rầy lột xác, an toàn môi trường"}
        ],
        "biological": [
            "Bảo vệ thiên địch: nhện, bọ xít mù xanh, ong ký sinh",
            "Thả vịt vào ruộng (1 con/100m²) ăn rầy tự nhiên",
            "Phun nấm Metarhizium anisopliae diệt rầy sinh học"
        ],
        "prevention": [
            "Sạ thưa (80 kg/ha), không bón thừa đạm",
            "Trồng xen hoa trên bờ ruộng thu hút thiên địch",
            "Theo dõi mật độ rầy bằng vợt/khay hàng tuần",
            "Luân canh giống kháng rầy"
        ]
    },

    # ═══════════════════════════════════════
    # NGÔ (CORN)
    # ═══════════════════════════════════════
    "corn_sau_keo": {
        "disease_vi": "Sâu Keo Mùa Thu",
        "disease_en": "Fall Armyworm",
        "crop": "corn",
        "severity": "critical",
        "emergency": [
            "Ngắt bỏ ổ trứng và sâu non tập trung ngay",
            "Rắc tro bếp + vôi vào nõn ngô hạn chế sâu đục",
            "Phun thuốc trừ sâu khẩn cấp khi sâu tuổi 1-2"
        ],
        "chemical": [
            {"name": "Spinetoram (Radiant 60SC)", "dosage": "0.15 lít/ha", "interval": "7 ngày/lần", "note": "Hiệu quả cao nhất khi sâu tuổi 1-3"},
            {"name": "Emamectin benzoate 5WG", "dosage": "0.2 kg/ha", "interval": "7 ngày/lần", "note": "Phun vào nõn ngô, chiều mát"},
            {"name": "Chlorantraniliprole 5SC", "dosage": "0.3 lít/ha", "interval": "14 ngày/lần", "note": "Phòng trừ lâu dài 14-21 ngày"}
        ],
        "biological": [
            "Sử dụng chế phẩm Bt (Bacillus thuringiensis var. kurstaki)",
            "Thả ong ký sinh Trichogramma (15.000 con/ha/lần)",
            "Phun nấm xanh Metarhizium diệt sâu sinh học"
        ],
        "prevention": [
            "Gieo giống ngô Bt kháng sâu (nếu có)",
            "Luân canh ngô - đậu - rau",
            "Cày lật đất sau thu hoạch diệt nhộng",
            "Đặt bẫy pheromone giám sát bướm cái đẻ trứng"
        ]
    },
    "corn_ri_sat": {
        "disease_vi": "Bệnh Rỉ Sắt Ngô",
        "disease_en": "Corn Rust",
        "crop": "corn",
        "severity": "medium",
        "emergency": [
            "Tỉa bỏ lá bệnh nặng ở tầng dưới",
            "Tăng khoảng cách thoáng gió giữa các hàng",
            "Phun thuốc trừ nấm ngay khi thấy đốm cam đầu tiên"
        ],
        "chemical": [
            {"name": "Azoxystrobin + Difenoconazole", "dosage": "0.5 lít/ha", "interval": "14 ngày/lần", "note": "Phun phòng trước khi trổ cờ"},
            {"name": "Propiconazole 25EC", "dosage": "0.5 lít/ha", "interval": "14 ngày/lần", "note": "Hiệu quả cao với gỉ sắt"},
            {"name": "Mancozeb 80WP", "dosage": "2 kg/ha", "interval": "7 ngày/lần", "note": "Thuốc tiếp xúc, phun đều mặt lá"}
        ],
        "biological": [
            "Bón Kali (K2O) tăng sức đề kháng tự nhiên",
            "Phun Nano Bạc + Nano Đồng sinh học",
            "Tăng cường phân hữu cơ vi sinh cải tạo đất"
        ],
        "prevention": [
            "Chọn giống ngô kháng gỉ sắt",
            "Không trồng liên tục ngô trên 1 vùng đất",
            "Thu dọn tàn dư cây bệnh sau thu hoạch",
            "Gieo trồng đúng thời vụ tránh mùa mưa kéo dài"
        ]
    },

    # ═══════════════════════════════════════
    # LÚA MÌ (WHEAT)
    # ═══════════════════════════════════════
    "wheat_ri_vang": {
        "disease_vi": "Bệnh Gỉ Vàng",
        "disease_en": "Yellow Rust",
        "crop": "wheat",
        "severity": "high",
        "emergency": [
            "Phun thuốc trừ nấm ngay khi phát hiện sọc vàng",
            "Cách ly ruộng bệnh, hạn chế đi lại",
            "Tăng thoáng gió bằng cách tỉa bỏ lá già"
        ],
        "chemical": [
            {"name": "Tebuconazole 25EC", "dosage": "0.5 lít/ha", "interval": "14 ngày/lần", "note": "Hấp thu nhanh qua lá"},
            {"name": "Epoxiconazole + Thiophanate-methyl", "dosage": "0.7 lít/ha", "interval": "14 ngày/lần", "note": "Phổ rộng trị nhiều loại nấm"},
        ],
        "biological": [
            "Phun chế phẩm Trichoderma phòng ngừa",
            "Bón phân Silic tăng cứng vách tế bào lá",
        ],
        "prevention": [
            "Gieo giống kháng gỉ: Lerma Rojo, Opata",
            "Luân canh 2-3 năm/lần",
            "Diệt cỏ dại xung quanh (ký chủ phụ của nấm)",
        ]
    },

    # ═══════════════════════════════════════
    # ĐẬU NÀNH (SOYBEAN)
    # ═══════════════════════════════════════
    "soybean_gi_sat": {
        "disease_vi": "Bệnh Gỉ Sắt Đậu Nành",
        "disease_en": "Soybean Rust",
        "crop": "soybean",
        "severity": "high",
        "emergency": [
            "Phun thuốc trừ nấm ngay khi phát hiện đốm nâu đỏ mặt dưới lá",
            "Loại bỏ lá bệnh nặng, tiêu hủy xa ruộng",
        ],
        "chemical": [
            {"name": "Tebuconazole + Trifloxystrobin", "dosage": "0.5 lít/ha", "interval": "14 ngày/lần", "note": "Phổ biến nhất trị gỉ đậu nành"},
            {"name": "Azoxystrobin 25SC", "dosage": "0.5 lít/ha", "interval": "14 ngày/lần", "note": "Phun giai đoạn ra hoa - đậu quả"},
        ],
        "biological": [
            "Bón phân Kali tăng đề kháng",
            "Dùng chế phẩm Bacillus subtilis phun phòng ngừa",
        ],
        "prevention": [
            "Luân canh với lúa hoặc ngô",
            "Xử lý hạt giống bằng thuốc trừ nấm trước khi gieo",
            "Không trồng dày, đảm bảo thoáng gió",
        ]
    },

    # ═══════════════════════════════════════
    # MÍA (SUGARCANE)
    # ═══════════════════════════════════════
    "sugarcane_thoi_do": {
        "disease_vi": "Bệnh Thối Đỏ",
        "disease_en": "Red Rot",
        "crop": "sugarcane",
        "severity": "critical",
        "emergency": [
            "Nhổ bỏ cây chết, tiêu hủy xa vùng trồng",
            "Ngừng tưới quá nhiều, để đất khô ráo",
            "Cách ly vùng bệnh bằng rãnh thoát nước"
        ],
        "chemical": [
            {"name": "Carbendazim 50WP", "dosage": "Ngâm hom 0.1% trong 30 phút", "interval": "Trước trồng", "note": "Xử lý hom giống trước khi trồng"},
            {"name": "Thiophanate-methyl 70WP", "dosage": "0.5 kg/ha", "interval": "14 ngày/lần", "note": "Phun gốc khi phát hiện bệnh"},
        ],
        "biological": [
            "Dùng nấm Trichoderma bón vào gốc",
            "Xử lý hom bằng nước nóng 52°C trong 30 phút",
        ],
        "prevention": [
            "Dùng hom giống từ ruộng sạch bệnh",
            "Vệ sinh dao khi chặt hom (khử trùng bằng cồn 70%)",
            "Luân canh mía - đậu 3-4 năm/lần",
            "Chọn giống kháng: ROC22, K84-200"
        ]
    },
    "sugarcane_sau_duc_than": {
        "disease_vi": "Sâu Đục Thân Mía",
        "disease_en": "Sugarcane Stem Borer",
        "crop": "sugarcane",
        "severity": "high",
        "emergency": [
            "Chẻ thân tìm và diệt sâu thủ công",
            "Cắt bỏ đoạn thân bị đục, tiêu hủy",
        ],
        "chemical": [
            {"name": "Chlorantraniliprole 0.4GR", "dosage": "7-10 kg/ha", "interval": "Rải 1 lần gốc", "note": "Rải hạt vào gốc mía khi cây mọc 30-40cm"},
            {"name": "Fipronil 0.3GR", "dosage": "10 kg/ha", "interval": "Rải 1 lần", "note": "Rải vào rãnh khi trồng"},
        ],
        "biological": [
            "Thả ong ký sinh Trichogramma chilonis (50.000 con/ha)",
            "Dùng nấm xanh Metarhizium xử lý đất trước trồng",
        ],
        "prevention": [
            "Bóc lá già gốc mía định kỳ",
            "Cày lật gốc sau thu hoạch diệt nhộng",
            "Đặt bẫy pheromone bắt bướm đêm",
        ]
    },

    # ═══════════════════════════════════════
    # KHOAI LANG (SWEET POTATO)
    # ═══════════════════════════════════════
    "sweet_potato_bo_ha": {
        "disease_vi": "Bọ Hà Khoai Lang (Sùng)",
        "disease_en": "Sweet Potato Weevil",
        "crop": "sweet_potato",
        "severity": "critical",
        "emergency": [
            "Đào bỏ củ bị sùng, tiêu hủy ngay",
            "Vun cao luống lấp kín mặt đất",
            "Tưới nước đẫm giữ ẩm đất (sùng ghét ẩm)"
        ],
        "chemical": [
            {"name": "Chlorpyrifos ethyl 20EC", "dosage": "2 lít/ha", "interval": "Tưới gốc 1 lần", "note": "Tưới gốc khi cây 30-40 ngày tuổi"},
            {"name": "Diazinon 10GR", "dosage": "20 kg/ha", "interval": "Rải 1 lần", "note": "Rải vào luống trước khi trồng"},
        ],
        "biological": [
            "Dùng nấm Beauveria bassiana xử lý đất",
            "Đặt bẫy pheromone giám sát bọ hà trưởng thành",
            "Trồng xen sả, húng quế xua đuổi bọ hà"
        ],
        "prevention": [
            "Luân canh 2-3 năm, không trồng liên tục",
            "Chọn hom giống sạch từ vùng không có sùng",
            "Thu hoạch đúng thời điểm, không để củ lâu trong đất",
            "Vun luống cao ≥ 30cm lấp kín củ"
        ]
    },

    # ═══════════════════════════════════════
    # SẮN (CASSAVA)
    # ═══════════════════════════════════════
    "cassava_kham_la": {
        "disease_vi": "Bệnh Khảm Lá Sắn",
        "disease_en": "Cassava Mosaic Disease",
        "crop": "cassava",
        "severity": "critical",
        "emergency": [
            "Nhổ bỏ cây bệnh ngay, KHÔNG giữ làm hom giống",
            "Tiêu hủy cây bệnh (đốt hoặc chôn sâu)",
            "Báo cơ quan BVTV địa phương nếu diện rộng"
        ],
        "chemical": [
            {"name": "Imidacloprid 25WP", "dosage": "0.2 kg/ha", "interval": "14 ngày/lần", "note": "Diệt bọ phấn trắng — vector truyền bệnh"},
            {"name": "Thiamethoxam 25WG", "dosage": "0.15 kg/ha", "interval": "14 ngày/lần", "note": "Phun khi mật độ bọ phấn cao"},
        ],
        "biological": [
            "Thả ong ký sinh Encarsia formosa diệt bọ phấn",
            "Phun nấm Lecanicillium lecanii trên bọ phấn",
            "Trồng bẫy cây cúc vạn thọ xung quanh ruộng"
        ],
        "prevention": [
            "QUAN TRỌNG NHẤT: Dùng hom giống sạch bệnh từ cơ sở uy tín",
            "Không vận chuyển hom từ vùng dịch",
            "Luân canh sắn - ngô - đậu",
            "Tiêu hủy toàn bộ tàn dư cây bệnh sau thu hoạch"
        ]
    },
    "cassava_choi_rong": {
        "disease_vi": "Bệnh Chổi Rồng",
        "disease_en": "Cassava Witches Broom",
        "crop": "cassava",
        "severity": "high",
        "emergency": [
            "Nhổ bỏ cây có chổi rồng, tiêu hủy",
            "Diệt rệp sáp bông (vector truyền bệnh)",
        ],
        "chemical": [
            {"name": "Imidacloprid 100SL", "dosage": "0.3 lít/ha", "interval": "14 ngày/lần", "note": "Trừ rệp sáp truyền bệnh"},
        ],
        "biological": [
            "Thả bọ rùa Cryptolaemus ăn rệp sáp",
            "Trồng xen cây họ đậu cải tạo đất",
        ],
        "prevention": [
            "Dùng hom sạch bệnh",
            "Kiểm soát rệp sáp bông định kỳ",
            "Luân canh 3 năm/lần",
        ]
    },

    # ═══════════════════════════════════════
    # KHOAI TÂY (POTATO)
    # ═══════════════════════════════════════
    "potato_moc_suong": {
        "disease_vi": "Bệnh Mốc Sương (Late Blight)",
        "disease_en": "Late Blight",
        "crop": "potato",
        "severity": "critical",
        "emergency": [
            "Cắt bỏ và tiêu hủy toàn bộ phần thân lá bệnh",
            "Phun thuốc trừ nấm khẩn cấp trong vòng 24 giờ",
            "Ngừng tưới phun, chuyển sang tưới gốc/tưới nhỏ giọt"
        ],
        "chemical": [
            {"name": "Mancozeb 80WP + Metalaxyl", "dosage": "2.5 kg/ha", "interval": "7 ngày/lần", "note": "Phun 3-4 lần liên tiếp khi mưa nhiều"},
            {"name": "Dimethomorph 50WP", "dosage": "0.4 kg/ha", "interval": "7 ngày/lần", "note": "Thuốc nội hấp, bảo vệ cả mặt dưới lá"},
            {"name": "Cymoxanil + Mancozeb", "dosage": "2 kg/ha", "interval": "7 ngày/lần", "note": "Trị + phòng đồng thời"}
        ],
        "biological": [
            "Phun Bacillus subtilis phòng ngừa sớm",
            "Bón phân hữu cơ vi sinh tăng vi sinh vật đối kháng trong đất",
        ],
        "prevention": [
            "Chọn giống kháng: Atlantic, Solara",
            "Trồng trên luống cao, thoát nước tốt",
            "Phun phòng Mancozeb trước mùa mưa",
            "Vun luống cao lấp kín củ tránh bào tử nấm xâm nhập"
        ]
    },
    "potato_virus_y": {
        "disease_vi": "Virus Y Khoai Tây",
        "disease_en": "Potato Virus Y (PVY)",
        "crop": "potato",
        "severity": "high",
        "emergency": [
            "Nhổ bỏ cây nhiễm virus, tiêu hủy",
            "Diệt rệp (vector truyền virus) ngay",
        ],
        "chemical": [
            {"name": "Imidacloprid 25WP", "dosage": "0.2 kg/ha", "interval": "14 ngày/lần", "note": "Trừ rệp muội — vector truyền virus"},
            {"name": "Lambda-cyhalothrin 5EC", "dosage": "0.3 lít/ha", "interval": "10 ngày/lần", "note": "Diệt rệp nhanh"},
        ],
        "biological": [
            "Thả bọ rùa ăn rệp tự nhiên",
            "Trồng bẫy cây cải xanh xung quanh ruộng",
        ],
        "prevention": [
            "Dùng củ giống sạch virus (từ nuôi cấy mô)",
            "Diệt rệp muội vector sớm",
            "Luân canh, không trồng khoai tây liên tục",
        ]
    },
    "corn_blight": {
        "disease_vi": "Bệnh Cháy Lá Ngô",
        "disease_en": "Corn Leaf Blight",
        "crop": "corn",
        "severity": "medium",
        "emergency": [
            "Tỉa bỏ các lá bị cháy nặng dưới gốc",
            "Dọn sạch tàn dư lá bệnh trong ruộng",
            "Ngừng tưới nước vào ban đêm để tránh ẩm cao"
        ],
        "chemical": [
            {"name": "Mancozeb 80WP", "dosage": "1.5-2.0 kg/ha", "interval": "7-10 ngày/lần", "note": "Phun khi phát hiện đốm bệnh đầu tiên"},
            {"name": "Carbendazim 50WP", "dosage": "0.5-1.0 lít/ha", "interval": "10 ngày/lần", "note": "Phun ướt đều mặt lá"}
        ],
        "biological": [
            "Bón phân hữu cơ vi sinh cải tạo đất",
            "Sử dụng chế phẩm nấm đối kháng Trichoderma bón lót",
            "Bón tăng Kali tăng cường sức đề kháng cho lá"
        ],
        "prevention": [
            "Luân canh cây trồng ngô - lúa - đậu",
            "Chọn giống ngô kháng bệnh cháy lá",
            "Vệ sinh đất kỹ càng trước khi trồng"
        ]
    },
    "sweet_potato_black_rot": {
        "disease_vi": "Bệnh Thối Đen Khoai Lang",
        "disease_en": "Sweet Potato Black Rot",
        "crop": "sweet_potato",
        "severity": "critical",
        "emergency": [
            "Nhổ bỏ dây và củ bị nhiễm bệnh đem đi tiêu hủy xa ruộng",
            "Khử trùng đất xung quanh hốc cây bị bệnh bằng vôi bột",
            "Tránh tưới ngập úng giữ ruộng thông thoáng"
        ],
        "chemical": [
            {"name": "Thiophanate-methyl 70WP", "dosage": "0.5-0.8 kg/ha", "interval": "7-10 ngày/lần", "note": "Phun phòng hoặc trị khi bệnh mới chớm"},
            {"name": "Carbendazim 500SC", "dosage": "0.6-1.0 lít/ha", "interval": "10 ngày/lần", "note": "Tưới hoặc phun gốc"}
        ],
        "biological": [
            "Sử dụng nấm đối kháng Trichoderma để xử lý đất trồng",
            "Xử lý hom giống bằng nước ấm hoặc chế phẩm sinh học",
            "Bón phân Kali sinh học tăng sức chống chịu của củ"
        ],
        "prevention": [
            "Sử dụng hom giống sạch bệnh từ ruộng giống khỏe mạnh",
            "Luân canh cây trồng ít nhất 2 năm",
            "Lên luống cao, thoát nước tốt trong mùa mưa"
        ]
    },
    "sweet_potato_scab": {
        "disease_vi": "Bệnh Ghẻ Lá Khoai Lang",
        "disease_en": "Sweet Potato Scab",
        "crop": "sweet_potato",
        "severity": "medium",
        "emergency": [
            "Cắt tỉa các lá bị ghẻ nặng, tiêu hủy",
            "Hạn chế phun nước lên lá trực tiếp",
            "Phun thuốc phòng trừ nấm phổ rộng ngay"
        ],
        "chemical": [
            {"name": "Difenoconazole + Azoxystrobin", "dosage": "0.3-0.4 lít/ha", "interval": "10-14 ngày/lần", "note": "Phun ướt đều tán lá"},
            {"name": "Chlorothalonil 75WP", "dosage": "1.0-1.5 kg/ha", "interval": "7 ngày/lần", "note": "Phun phòng khi mưa ẩm kéo dài"}
        ],
        "biological": [
            "Phun chế phẩm Nano Đồng sinh học đối kháng nấm",
            "Sử dụng dịch tỏi hoặc tinh dầu thảo mộc phun ngừa",
            "Bón bổ sung Canxi-Bo nâng cao độ cứng biểu bì lá"
        ],
        "prevention": [
            "Trồng mật độ vừa phải, tránh trồng quá dày",
            "Không dùng hom giống từ vùng nhiễm bệnh ghẻ",
            "Thoát nước triệt để cho ruộng sau mưa"
        ]
    },
    "potato_early_blight": {
        "disease_vi": "Bệnh Cháy Sớm Khoai Tây",
        "disease_en": "Potato Early Blight",
        "crop": "potato",
        "severity": "high",
        "emergency": [
            "Ngắt bỏ các lá đốm cháy sớm ở tầng dưới gốc",
            "Giảm tưới nước phun mưa, chuyển sang tưới rãnh",
            "Dọn sạch cỏ dại xung quanh ruộng để tăng độ thông thoáng"
        ],
        "chemical": [
            {"name": "Mancozeb 80WP", "dosage": "2.0 kg/ha", "interval": "7 ngày/lần", "note": "Phun ngay khi thấy đốm nâu tròn đồng tâm"},
            {"name": "Chlorothalonil 500SC", "dosage": "1.2 lít/ha", "interval": "7-10 ngày/lần", "note": "Phun luân phiên để tránh kháng thuốc"}
        ],
        "biological": [
            "Phun Bacillus subtilis liều lượng theo hướng dẫn định kỳ 10 ngày",
            "Bón phân hữu cơ vi sinh cung cấp dinh dưỡng cân đối",
            "Tăng cường Silic và Kali giúp lá cây dày cứng cáp"
        ],
        "prevention": [
            "Tránh tưới nước lên lá khoai tây vào buổi chiều tối",
            "Luân canh với cây trồng không thuộc họ Cà (như lúa, ngô)",
            "Sử dụng củ giống khỏe mạnh, sạch bệnh"
        ]
    },
    "wheat_septoria": {
        "disease_vi": "Bệnh Đốm Septoria Lúa Mì",
        "disease_en": "Wheat Septoria Leaf Blotch",
        "crop": "wheat",
        "severity": "high",
        "emergency": [
            "Phun thuốc trừ nấm ngay khi phát hiện đốm xám đen trên lá",
            "Hạn chế đi lại qua vùng ruộng bệnh",
            "Cắt tỉa các lá già nhiễm bệnh nặng dưới gốc"
        ],
        "chemical": [
            {"name": "Tebuconazole 250EC", "dosage": "0.5 lít/ha", "interval": "14 ngày/lần", "note": "Hiệu quả nội hấp cao"},
            {"name": "Propiconazole 250EC", "dosage": "0.4-0.5 lít/ha", "interval": "10-14 ngày/lần", "note": "Phun phòng và trị nấm Septoria"}
        ],
        "biological": [
            "Sử dụng chế phẩm Trichoderma xử lý rơm rạ sau vụ thu hoạch",
            "Bón phân Kali và Silic để tăng đề kháng thành tế bào",
            "Phun nano đồng sinh học bảo vệ bề mặt lá"
        ],
        "prevention": [
            "Sử dụng giống lúa mì kháng bệnh Septoria",
            "Tránh gieo sạ quá dày",
            "Dọn sạch và cày vùi sâu tàn dư cây bệnh sau thu hoạch"
        ]
    },
    "sugarcane_rust": {
        "disease_vi": "Bệnh Gỉ Sắt Mía",
        "disease_en": "Sugarcane Rust",
        "crop": "sugarcane",
        "severity": "medium",
        "emergency": [
            "Bóc bỏ bớt lá mía bệnh nặng ở phần gốc",
            "Tăng cường thoát nước, không để đọng nước trong rãnh",
            "Phun thuốc trừ nấm phổ rộng ngay lập tức"
        ],
        "chemical": [
            {"name": "Azoxystrobin 250SC", "dosage": "0.4 lít/ha", "interval": "14 ngày/lần", "note": "Phun phòng trước và trong mùa mưa ẩm"},
            {"name": "Tebuconazole + Trifloxystrobin", "dosage": "0.5 kg/ha", "interval": "14 ngày/lần", "note": "Hiệu quả trị nấm gỉ sắt tốt"}
        ],
        "biological": [
            "Bón tăng phân Kali giúp mía vươn lóng khỏe và chống chịu nấm",
            "Phun chế phẩm vi sinh đối kháng nấm rỉ sắt",
            "Bón phân hữu cơ vi sinh để cải tạo đất gốc"
        ],
        "prevention": [
            "Sử dụng giống mía kháng bệnh gỉ sắt (như ROC22, K84)",
            "Đảm bảo ruộng mía thông thoáng, lột lá định kỳ",
            "Chọn đất trồng cao ráo, thoát nước tốt"
        ]
    },
    "cassava_bacterial_blight": {
        "disease_vi": "Bệnh Cháy Lá Vi Khuẩn Sắn",
        "disease_en": "Cassava Bacterial Blight",
        "crop": "cassava",
        "severity": "critical",
        "emergency": [
            "Nhổ bỏ cây bị cháy lá vi khuẩn nặng đem chôn sâu hoặc đốt",
            "Ngừng tưới nước, cách ly vùng bệnh bằng rãnh sâu",
            "Vệ sinh dao chặt hom cẩn thận sau khi tiếp xúc cây bệnh"
        ],
        "chemical": [
            {"name": "Bismerthiazol 20WP", "dosage": "0.5-0.8 kg/ha", "interval": "7 ngày/lần", "note": "Đặc trị vi khuẩn hại cây trồng"},
            {"name": "Kasugamycin 2% (Kasuran)", "dosage": "1.5 lít/ha", "interval": "7-10 ngày/lần", "note": "Thuốc kháng sinh thực vật an toàn"}
        ],
        "biological": [
            "Phun Nano Bạc - Đồng sinh học diệt khuẩn",
            "Bón bổ sung vi lượng tăng đề kháng tự nhiên",
            "Bón đạm cân đối, tránh dư thừa đạm làm lá mọng nước dễ nhiễm khuẩn"
        ],
        "prevention": [
            "Chọn hom giống khỏe, tuyệt đối sạch bệnh",
            "Luân canh đất trồng sắn với cây họ đậu",
            "Vệ sinh đồng ruộng triệt để sau thu hoạch"
        ]
    },
    "soybean_blight": {
        "disease_vi": "Bệnh Cháy Lá Đậu Nành",
        "disease_en": "Soybean Bacterial Blight",
        "crop": "soybean",
        "severity": "high",
        "emergency": [
            "Phun thuốc kháng khuẩn ngay khi thấy đốm sũng nước lan rộng",
            "Tránh lội vào ruộng khi lá còn ướt để không lây lan vi khuẩn",
            "Thu dọn lá bệnh rụng đem đi chôn lấp"
        ],
        "chemical": [
            {"name": "Copper Hydroxide (Kocide 53.8DF)", "dosage": "1.0-1.2 kg/ha", "interval": "7-10 ngày/lần", "note": "Thuốc gốc đồng diệt khuẩn tiếp xúc"},
            {"name": "Kasugamycin 2SL", "dosage": "1.2-1.5 lít/ha", "interval": "10 ngày/lần", "note": "Kháng sinh diệt khuẩn nội hấp"}
        ],
        "biological": [
            "Sử dụng chế phẩm EM phun phòng định kỳ",
            "Bón phân cân đối NPK, đặc biệt Kali giúp cây chắc khỏe",
            "Xử lý hạt giống bằng chế phẩm sinh học trước khi gieo"
        ],
        "prevention": [
            "Gieo hạt giống sạch bệnh, có nguồn gốc rõ ràng",
            "Mật độ trồng hợp lý, không trồng quá dày làm ruộng ẩm thấp",
            "Luân canh lúa - đậu nành cắt đứt chu kỳ vi khuẩn"
        ]
    }
}

# Ánh xạ cây trồng → danh sách bệnh tương ứng
CROP_DISEASES = {}
for key, data in TREATMENT_DB.items():
    crop = data["crop"]
    if crop not in CROP_DISEASES:
        CROP_DISEASES[crop] = []
    CROP_DISEASES[crop].append({
        "key": key,
        "disease_vi": data["disease_vi"],
        "disease_en": data["disease_en"],
        "severity": data["severity"]
    })
