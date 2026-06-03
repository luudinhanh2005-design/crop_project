# ai_service.py
import os
import json
from typing import Dict, Any

class AIService:
    _gemini_model = None
    _initialized = False

    @classmethod
    def _init_gemini(cls):
        if cls._initialized:
            return
        try:
            import google.generativeai as genai
            api_key = os.getenv("GEMINI_API_KEY", "")
            model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            if api_key:
                genai.configure(api_key=api_key)
                cls._gemini_model = genai.GenerativeModel(model_name)
                print(f"[OK] Explore AIService initialized with model: {model_name}")
            else:
                print("[INFO] No GEMINI_API_KEY found, using rule-based agricultural fallback engine.")
        except Exception as e:
            print(f"[WARN] Failed to initialize Gemini AI: {e}. Fallback enabled.")
        cls._initialized = True

    @classmethod
    def generate_crop_analysis(cls, crop_name: str, temp: float, humidity: float, region: str) -> Dict[str, Any]:
        """
        Phân tích rủi ro nông nghiệp cho một loại cây dựa trên thời tiết và vùng miền.
        Hỗ trợ fallback tự động cực kỳ tin cậy nếu API Gemini không hoạt động hoặc không có mạng.
        """
        cls._init_gemini()
        
        prompt = (
            f"Bạn là một chuyên gia AI Nông Nghiệp. Hãy phân tích tính tương thích sinh trưởng của cây {crop_name} "
            f"trong điều kiện nhiệt độ {temp}°C, độ ẩm {humidity}% tại khu vực Miền {region}. "
            f"Hãy trả về phản hồi dưới định dạng JSON thuần túy (không bọc trong markdown hay ```json) chứa cấu trúc sau:\n"
            f'{{"risk_score": 0-100, "warnings": ["cảnh báo 1", "cảnh báo 2"], '
            f'"weather_compatibility": "mô tả tương thích", '
            f'"expert_tips": "lời khuyên cụ thể giai đoạn này", '
            f'"forecast": "dự báo sinh trưởng tuần tới"}}'
        )

        if cls._gemini_model:
            try:
                response = cls._gemini_model.generate_content(prompt)
                text = response.text.strip()
                # Khử markdown nếu AI tự động chèn vào
                if text.startswith("```"):
                    text = text.replace("```json", "").replace("```", "").strip()
                return json.loads(text)
            except Exception as err:
                print(f"[WARN] Gemini error: {err}. Using high-fidelity fallback parser.")
        
        # Mô hình Fallback quy tắc chất lượng cao (Rule-based)
        risk_score = 15
        warnings = []
        compatibility = "Điều kiện thời tiết bình thường cho cây sinh trưởng."

        if temp > 35:
            risk_score += 30
            warnings.append("Nhiệt độ quá cao dễ gây cháy lá và thoát nước nhanh vùng rễ.")
            compatibility = "Nắng nóng cực đoan gây hạn chế sinh trưởng nhẹ."
        elif temp < 15:
            risk_score += 25
            warnings.append("Thời tiết rét hại gây ngưng trệ dòng nhựa sinh trưởng của cây non.")
            compatibility = "Lạnh kéo dài làm chậm chu kỳ ra hoa đơm bông."
            
        if humidity > 85:
            risk_score += 25
            warnings.append("Độ ẩm không khí rất cao tạo điều kiện thuận lợi cho nấm lá phát triển.")
        elif humidity < 40:
            risk_score += 20
            warnings.append("Khô hạn cục bộ vùng đất mặt, cần tăng lượng nước tưới sáng sớm.")

        if risk_score > 60:
            status = "Cảnh báo cao"
        elif risk_score > 35:
            status = "Cảnh báo vừa"
        else:
            status = "Thuận lợi hoàn toàn"

        expert_tips = f"Đối với giống {crop_name} tại miền {region}, hãy duy trì kiểm tra sâu đục bẹ lá và bổ sung lân hữu cơ định kỳ giai đoạn này."
        forecast = f"Trong 7 ngày tới, tình trạng {status.lower()} tiếp diễn. Đề xuất giữ nước mặt ruộng ở mức 3cm."

        return {
            "risk_score": min(risk_score, 100),
            "warnings": warnings if warnings else ["Thời tiết ổn định, không ghi nhận rủi ro đặc biệt."],
            "weather_compatibility": compatibility,
            "expert_tips": expert_tips,
            "forecast": forecast
        }
