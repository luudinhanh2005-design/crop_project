@echo off
chcp 65001 >nul
echo ========================================================
echo      KHOI DONG HE THONG AI CROP SCANNER (LEVEL 3)
echo ========================================================
echo.
echo Vui long cho trong giay lat, he thong dang tai Mo hinh Nao bo AI...
echo (Cua so trinh duyet se tu dong mo ngay sau do)
echo.

:: Mở trình duyệt mặc định thẳng vào link của hệ thống
start http://localhost:8000

:: Kích hoạt máy chủ FastAPI (Bằng Python trong venv)
.\venv\Scripts\python.exe api.py

pause
