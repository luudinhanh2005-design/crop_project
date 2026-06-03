@echo off
echo ==============================================
echo    CROP RECOGNITION AI - LAUNCH PROJECT       
echo ==============================================

echo Đang khởi động Hệ thống AI và Giao diện Web (GPU Mode)...
start cmd /k "cd backend && set PYTHONIOENCODING=utf-8 && set PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v11.2\bin;%%PATH%% && ..\venv_gpu\Scripts\python.exe -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo Hoan tat! Dang mo trinh duyet...
timeout /t 5 /nobreak >nul
start http://localhost:8000

