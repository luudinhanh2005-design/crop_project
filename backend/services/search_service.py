# search_service.py
import re
import difflib
import time
import unicodedata

class SearchService:
    @staticmethod
    def remove_vietnamese_diacritics(text: str) -> str:
        """Chuẩn hóa Unicode và xóa toàn bộ dấu tiếng Việt"""
        if not text:
            return ""
        # Chuẩn hóa Unicode sang dạng tổ hợp (NFD) để tách nguyên âm và dấu thanh
        normalized = unicodedata.normalize('NFD', text)
        # Loại bỏ các ký tự dấu thanh (Combining Diacritical Marks)
        no_diacritics = re.sub(r'[\u0300-\u036f]', '', normalized)
        # Thay thế ký tự đ/Đ đặc thù tiếng Việt
        no_diacritics = no_diacritics.replace('đ', 'd').replace('Đ', 'D')
        # Chuẩn hóa lại sang NFC
        return unicodedata.normalize('NFC', no_diacritics).lower().strip()

    @classmethod
    def calculate_match_score(cls, query: str, target: str) -> float:
        """
        Tính điểm khớp giữa query và target (đã chuẩn hóa).
        Khớp chính xác = 1.0
        Khớp chuỗi con từ đầu từ = 0.8
        Khớp chuỗi con bất kỳ = 0.5
        Khớp mờ (Fuzzy) = ratio
        """
        q = cls.remove_vietnamese_diacritics(query)
        t = cls.remove_vietnamese_diacritics(target)
        
        if not q or not t:
            return 0.0
            
        if q == t:
            return 1.0
            
        if t.startswith(q):
            return 0.8
            
        if q in t:
            return 0.6
            
        # Tính toán tỷ lệ so khớp mờ
        return difflib.SequenceMatcher(None, q, t).ratio()
