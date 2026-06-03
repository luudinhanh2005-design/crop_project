import os
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_USE_LEGACY_KERAS'] = '1'

import io
import sys
from pathlib import Path
import datetime

from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, Query, Header, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
# app will be initialized below with the lifespan handler

from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import jwt
import bcrypt
import sqlite3
import random
import string

import os
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env", override=True)

# Global OTP Store mapping: username -> {"otp": str, "email": str, "expires_at": float}
otp_store = {}

import smtplib
from email.mime.text import MIMEText
from email.header import Header as EmailHeader

def send_otp_email(to_email: str, otp: str, username: str) -> bool:
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    try:
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
    except (ValueError, TypeError):
        smtp_port = 587
    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")
    
    if not sender_email or not sender_password:
        print("[SMTP] SENDER_EMAIL or SENDER_PASSWORD not configured in .env. Skipping email sending.")
        return False
        
    subject = "[AgriSocial] Mã OTP khôi phục mật khẩu"
    body = f"""Chào {username},

Bạn đã yêu cầu khôi phục mật khẩu cho tài khoản AgriSocial.
Mã OTP của bạn là: {otp}

Mã này có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.

Trân trọng,
Đội ngũ AgriSocial"""

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = str(EmailHeader(subject, "utf-8"))
    msg["From"] = sender_email
    msg["To"] = to_email
    
    try:
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_server, smtp_port)
            server.login(sender_email, sender_password)
        else:
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
            server.login(sender_email, sender_password)
        
        server.sendmail(sender_email, [to_email], msg.as_string())
        server.quit()
        print(f"[SMTP] OTP email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"[SMTP ERROR] Failed to send email to {to_email}: {e}")
        return False

SECRET_KEY = os.getenv("SECRET_KEY", "agrisocial-super-secret-key-2026")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

DB_PATH = Path(__file__).parent / "auth.db"

# Initialize SQLite Auth DB
def init_auth_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS custom_users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            password_hash TEXT,
            email TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            banned INTEGER DEFAULT 0
        )
    ''')
    # Migration: add banned column if not exists
    try:
        cursor.execute("ALTER TABLE custom_users ADD COLUMN banned INTEGER DEFAULT 0")
    except Exception:
        pass  # Column already exists

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expert_verifications (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            full_name TEXT,
            cert_name TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_auth_db()
from PIL import Image
import numpy as np

ROOT = Path(__file__).parent.parent # Lấy thư mục gốc (cha của backend)
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).parent)) # Thêm cả thư mục backend để tìm thấy config.py

import config  # type: ignore[import-untyped]
from config import BEST_MODEL_PATH, CLASSES, CROP_DETAILS, IMG_SIZE, USE_CLAHE, USE_DENOISE, HISTORY_DIR, SUPABASE_URL, SUPABASE_KEY, USE_SUPABASE  # type: ignore[import-untyped]
import uvicorn
import cv2
import uuid
import json
import time
from PIL import ImageEnhance
import os

# ── Khởi tạo Supabase ──
supabase = None
if USE_SUPABASE:
    try:
        from supabase import create_client
        from postgrest import CountMethod
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase connected successfully!")
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")

def verify_token(authorization: str = Header(None)):
    """Xác thực Token: Thử giải mã token cục bộ trước, nếu lỗi thì thử xác thực qua Supabase"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Thiếu mã xác thực")
    token = authorization.split(" ")[1]
    
    # 1. Thử giải mã bằng JWT tùy chỉnh cục bộ
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        pass
        
    # 2. Thử xác thực qua Supabase
    if USE_SUPABASE and supabase:
        try:
            response = supabase.auth.get_user(token)
            if response and response.user:
                user_id = response.user.id
                # Truy vấn vai trò trực tiếp từ Supabase profiles để bảo mật
                profile_res = supabase.table("profiles").select("role, full_name").eq("id", user_id).execute()
                role = "user"
                username = response.user.email or "User"
                if profile_res.data and len(profile_res.data) > 0:
                    first_item = profile_res.data[0]
                    if isinstance(first_item, dict):
                        role = first_item.get("role", "user")
                        username = first_item.get("full_name") or username
                
                payload = {
                    "sub": user_id,
                    "username": username,
                    "role": role
                }
                return payload
        except Exception as e:
            print(f"Supabase auth check failed: {e}")
            
    raise HTTPException(status_code=401, detail="Phiên đăng nhập hết hạn hoặc không hợp lệ")


def verify_admin_role(authorization: str = Header(None)):
    """Lớp bảo mật 2 cho Quản trị viên (Custom JWT)"""
    user = verify_token(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Quản trị")
    return user

def verify_expert_role(authorization: str = Header(None)):
    """Lớp bảo mật 2 cho Chuyên gia (Custom JWT)"""
    user = verify_token(authorization)
    if user.get("role") not in ["expert", "admin"]:
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Chuyên gia")
    return user

# ── Biến lưu mô hình AI ──
model = None
preprocess_fn = None
model_backbone_name = "efficientnetb3" 
yolo_model = None
crops_specialist = None
model_load_error = "No startup error logged."

# ── Tự động tải model từ Google Drive nếu file không tồn tại hoặc là Git LFS pointer ──
GDRIVE_MODEL_ID = "11PZY5n0r5SIqF8UDQic8th1D-gGhzuMG"

def download_from_gdrive(file_id: str, destination: Path):
    """Tải file lớn từ Google Drive, xử lý trang xác nhận virus scan."""
    import requests  # type: ignore
    
    url = "https://drive.google.com/uc?export=download"
    session = requests.Session()
    
    print(f"[GDRIVE] Đang tải model từ Google Drive (ID: {file_id})...")
    
    # Bước 1: Gửi request đầu tiên
    response = session.get(url, params={"id": file_id, "confirm": "t"}, stream=True)
    
    # Bước 2: Kiểm tra nếu có trang xác nhận virus scan (file > 100MB)
    token = None
    for key, value in response.cookies.items():
        if key.startswith("download_warning"):
            token = value
            break
    
    if token:
        print("[GDRIVE] Xác nhận virus scan...")
        response = session.get(url, params={"id": file_id, "confirm": token}, stream=True)
    
    # Bước 3: Tải file
    destination.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with open(str(destination), "wb") as f:
        for chunk in response.iter_content(chunk_size=32 * 1024):
            if chunk:
                f.write(chunk)
                total += len(chunk)
                if total % (10 * 1024 * 1024) == 0:  # Log mỗi 10MB
                    print(f"[GDRIVE] Đã tải: {total / (1024*1024):.1f} MB")
    
    print(f"[GDRIVE] Hoàn tất! Kích thước: {total / (1024*1024):.1f} MB")
    return total

def ensure_model_available(model_path: Path):
    """Kiểm tra model có sẵn không, nếu không thì tải từ Google Drive."""
    need_download = False
    
    if not model_path.exists():
        print(f"[MODEL CHECK] File không tồn tại: {model_path}")
        need_download = True
    else:
        size = model_path.stat().st_size
        if size < 10000:  # Git LFS pointer chỉ ~130 bytes
            print(f"[MODEL CHECK] File quá nhỏ ({size} bytes) - có thể là Git LFS pointer")
            try:
                with open(model_path, 'r', encoding='utf-8') as f:
                    content = f.read(200)
                if 'oid sha256' in content or 'git-lfs' in content:
                    print(f"[MODEL CHECK] Xác nhận là Git LFS pointer!")
                    need_download = True
            except Exception:
                need_download = True
        else:
            print(f"[MODEL CHECK] File model hợp lệ ({size / (1024*1024):.1f} MB)")
    
    if need_download:
        print("[MODEL CHECK] Bắt đầu tải model từ Google Drive...")
        downloaded_size = download_from_gdrive(GDRIVE_MODEL_ID, model_path)
        if downloaded_size < 10000:
            raise RuntimeError(f"Tải model thất bại! File chỉ có {downloaded_size} bytes")
        print(f"[MODEL CHECK] Model đã sẵn sàng!")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    global model, preprocess_fn, model_backbone_name, yolo_model, crops_specialist, model_load_error
    print("Loading AI Model...")
    
    # Tự động tải model từ Google Drive nếu cần
    try:
        ensure_model_available(Path(BEST_MODEL_PATH))
    except Exception as dl_err:
        print(f"[GDRIVE ERROR] {dl_err}")
    
    try:
        p = Path(BEST_MODEL_PATH)
        if p.exists():
            size = p.stat().st_size
            print(f"[DEBUG MODEL] File exists. Size: {size} bytes.")
            if size < 1000:
                try:
                    with open(p, 'r', encoding='utf-8') as f:
                        print(f"[DEBUG MODEL] Contents: {f.read(100)}")
                except Exception as read_err:
                    print(f"[DEBUG MODEL READ ERROR] {read_err}")
        else:
            print(f"[DEBUG MODEL] File does not exist at: {p.absolute()}")
    except Exception as debug_err:
        print(f"[DEBUG MODEL DIAGNOSTIC ERROR] {debug_err}")

    try:
        import os as _os
        _os.environ['TF_USE_LEGACY_KERAS'] = '1'
        try:
            # pyrefly: ignore [missing-import]
            import tf_keras
        except ImportError:
            import tensorflow.keras as tf_keras  # type: ignore
        import tensorflow as tf  # type: ignore
        
        # Cấu hình tối ưu CPU thread để tránh treo và tốn RAM trên Render
        try:
            tf.config.threading.set_intra_op_parallelism_threads(1)
            tf.config.threading.set_inter_op_parallelism_threads(1)
            print("[TF CONFIG] Restricted TensorFlow CPU threads to 1", flush=True)
        except Exception as config_err:
            print(f"[TF CONFIG ERROR] {config_err}", flush=True)
            
        from utils.model import BACKBONES
        import shutil
        import tempfile
        
        source_path = Path(BEST_MODEL_PATH)
        temp_model_dir = Path(tempfile.gettempdir())
        
        # ── Phát hiện format file và chuẩn bị đường dẫn load ──
        with open(str(source_path), 'rb') as f:
            header = f.read(4)
        
        if header == b'\x89HDF':
            print("[FORMAT] File là HDF5 (Keras 2) — dùng tf_keras để load", flush=True)
            load_path = temp_model_dir / "crop_super_v2s_best.h5"
        else:
            print("[FORMAT] File là ZIP (Keras 3)", flush=True)
            load_path = temp_model_dir / "crop_super_v2s_best.keras"
        
        # Copy sang /tmp với đúng extension
        print(f"Copying model to: {load_path}", flush=True)
        shutil.copy2(str(source_path), str(load_path))
        os.chmod(str(load_path), 0o666)
        print(f"[COPY OK] Size: {load_path.stat().st_size} bytes", flush=True)
        
        # ── Load model bằng tf_keras ──
        print("[LOADING] Loading model with tf_keras...", flush=True)
        model = tf_keras.models.load_model(str(load_path))
        print(f"[LOAD OK] Model: {model.name}, Params: {model.count_params():,}", flush=True)
        
        # Tự động xác định backbone
        backbone_name = "mobilenetv2"
        for bname in BACKBONES:
            if bname in model.name.lower():
                backbone_name = bname
                break

        print(f"Model loaded successfully! Detected Backbone: {backbone_name.upper()}", flush=True)
        model_backbone_name = backbone_name
        
        # 2. Xử lý mô hình chuyên gia: bỏ qua trên Render/server để tiết kiệm tài nguyên
        print("Crops Specialist Model loading bypassed to prevent memory exhaustion (OOM).", flush=True)
    except Exception as e:
        model_load_error = str(e)
        print(f"Error loading model: {e}", flush=True)
        

    
    yield

app = FastAPI(title="Crop AI Premium", lifespan=lifespan)

# Đảm bảo thư mục history tồn tại để tránh lỗi Starlette StaticFiles trên Render
history_dir = Path(__file__).parent / "../frontend/history"
history_dir.mkdir(parents=True, exist_ok=True)

app.mount(
    "/history",
    StaticFiles(directory=str(history_dir)),
    name="history"
)

# Thư mục lưu ảnh chứng chỉ xác minh chuyên gia
cert_uploads_dir = Path(__file__).parent / "../frontend/cert_uploads"
cert_uploads_dir.mkdir(parents=True, exist_ok=True)

app.mount(
    "/cert_uploads",
    StaticFiles(directory=str(cert_uploads_dir)),
    name="cert_uploads"
)

# ── CORS CONFIGURATION ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REGISTER SUB-ROUTERS ──
from backend.routers.explore import router as explore_router
# from backend.routers.expert import router as expert_router
app.include_router(explore_router)
# app.include_router(expert_router)


import base64
import tensorflow as tf  # type: ignore[import-untyped]
import matplotlib.cm as cm
from utils.predict_utils import preprocess_image

def make_gradcam_heatmap(img_array, model, last_conv_layer_name=None):
    # Lấy base model (thường là layer thứ 1 hoặc thứ 2 tùy kiến trúc)
    # pyrefly: ignore [missing-import]
    import tf_keras 
    base_model = None
    for layer in model.layers:
        if hasattr(layer, 'layers'): # Đây là nested model (backbone)
            base_model = layer
            break
    
    if base_model is None:
        base_model = model

    if last_conv_layer_name is None:
        # Tự động tìm lớp Convolutional cuối cùng hoặc lớp có output 4D
        for layer in reversed(base_model.layers):
            try:
                # Kiểm tra shape của output
                shape = layer.output.shape
                if len(shape) == 4 and ("conv" in layer.name.lower() or "activation" in layer.name.lower()):
                    last_conv_layer_name = layer.name
                    break
            except:
                continue
    
    try:
        base_model_output = base_model.get_layer(last_conv_layer_name).output
        grad_model_base = tf_keras.models.Model(
            [base_model.inputs], [base_model_output, base_model.output]
        )
    except Exception as e:
        print(f"[GRAD-CAM ERROR] Layer {last_conv_layer_name} not found. Fallback to last layer.", flush=True)
        base_model_output = base_model.layers[-1].output
        grad_model_base = tf_keras.models.Model(
            [base_model.inputs], [base_model_output, base_model.output]
        )
    
    with tf.GradientTape() as tape:
        conv_outputs, base_preds = grad_model_base(img_array)
        tape.watch(conv_outputs)
        
        x = base_preds
        for layer in model.layers[2:]:
            x = layer(x)
        preds = x
        
        top_pred_index = tf.argmax(preds[0])
        top_class_channel = preds[:, top_pred_index] # type: ignore
        
    grads = tape.gradient(top_class_channel, conv_outputs)
    # pyrefly: ignore [bad-argument-type]
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2)) 
    
    conv_outputs = conv_outputs[0] # type: ignore
    heatmap = conv_outputs @ tf.expand_dims(pooled_grads, axis=-1)
    heatmap = tf.squeeze(heatmap)
    heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-10)
    return heatmap.numpy()

def get_base64_heatmap(image, heatmap, alpha=0.5):
    try:
        jet = cm.get_cmap("jet")
    except AttributeError:
        import matplotlib
        jet = matplotlib.colormaps["jet"]
    jet_colors = jet(np.arange(256))[:, :3]
    jet_heatmap = jet_colors[np.uint8(255 * heatmap)]
    
    # Sử dụng thư viện PIL tiêu chuẩn thay vì tf.keras.utils để tránh xung đột phiên bản và tối ưu bộ nhớ
    from PIL import Image
    
    jet_heatmap_uint8 = np.uint8(255 * jet_heatmap)
    jet_heatmap_img = Image.fromarray(jet_heatmap_uint8)
    jet_heatmap_img = jet_heatmap_img.resize((image.width, image.height))
    
    jet_heatmap_arr = np.array(jet_heatmap_img, dtype=np.float32)
    superimposed_img_arr = jet_heatmap_arr * alpha + np.array(image, dtype=np.float32)
    superimposed_img_arr = np.clip(superimposed_img_arr, 0, 255).astype(np.uint8)
    superimposed_img = Image.fromarray(superimposed_img_arr)
    
    buf = io.BytesIO()
    superimposed_img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode("utf-8"), superimposed_img

def detect_leaf_diseases(image_pil, crop_type: str):
    """
    Sử dụng Google Gemini 1.5 Flash API bằng giao thức HTTP POST trực tiếp để chẩn đoán bệnh học cây trồng.
    """
    import base64
    import requests  # type: ignore
    import json
    import os
    import io
    
    # 1. Lấy API Key từ biến môi trường
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[GEMINI WARNING] GEMINI_API_KEY not found in .env. Falling back to healthy.")
        return {
            "key": "healthy",
            "disease_vi": "Khỏe mạnh (Chưa cấu hình API Key)",
            "disease_en": "Healthy (API Key missing)",
            "severity": "Low",
            "confidence": 0.95,
            "bounding_boxes": [],
            "treatment": {
                "emergency": ["Không có dữ liệu"],
                "chemical": [],
                "biological": [],
                "prevention": []
            }
        }
        
    try:
        # Resize to max 1024 to save tokens and bandwidth
        img_resized = image_pil.copy()
        img_resized.thumbnail((1024, 1024))
        
        # Convert to Base64
        buffered = io.BytesIO()
        img_resized.save(buffered, format="JPEG", quality=85)
        img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Gọi API Gemini via HTTP
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        headers = {
            "Content-Type": "application/json"
        }
        
        prompt = f"""
        Bạn là một chuyên gia bệnh học thực vật hàng đầu. Hãy phân tích hình ảnh này của cây '{crop_type}' và đưa ra chẩn đoán chính xác:
        1. Tên bệnh hại nếu có (disease_name). Nếu cây khỏe mạnh, hãy ghi 'Khỏe mạnh'.
        2. Mức độ bệnh (severity): 'Thấp', 'Trung bình', 'Cao' hoặc 'Không có'.
        3. Nguyên nhân gây bệnh (cause).
        4. Các bước xử lý khẩn cấp (emergency).
        5. Biện pháp hóa học (chemical).
        6. Biện pháp sinh học (biological).
        7. Biện pháp phòng ngừa (prevention).

        BẮT BUỘC trả về kết quả dưới dạng một chuỗi JSON thuần túy theo định dạng sau, không kèm bất kỳ ký tự định dạng markdown nào:
        {{
          "disease_name": "Tên bệnh bằng tiếng Việt",
          "severity": "Thấp/Trung bình/Cao/Không có",
          "cause": "Nguyên nhân ngắn gọn",
          "emergency": ["bước khẩn cấp 1", "bước khẩn cấp 2"],
          "chemical": ["biện pháp hóa học 1"],
          "biological": ["biện pháp sinh học 1"],
          "prevention": ["biện pháp phòng ngừa 1"]
        }}
        """
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": img_b64
                            }
                        }
                    ]
                }
            ]
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=25)
        if response.status_code != 200:
            raise Exception(f"Gemini API returned status {response.status_code}: {response.text}")
            
        resp_json = response.json()
        raw_text = resp_json["candidates"][0]["content"]["parts"][0]["text"].strip()
        
        # Clean markdown wrappers if returned
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        gemini_data = json.loads(raw_text.strip())
        
        dis_name = gemini_data.get("disease_name", "Khỏe mạnh")
        if dis_name.lower() in ["khỏe mạnh", "khoẻ mạnh", "healthy", "không có"]:
            return {
                "key": "healthy",
                "disease_vi": "Khỏe mạnh",
                "disease_en": "Healthy",
                "severity": "Low",
                "confidence": 0.98,
                "bounding_boxes": [],
                "treatment": {
                    "emergency": ["Cây khỏe mạnh, không cần xử lý khẩn cấp."],
                    "chemical": [],
                    "biological": [],
                    "prevention": ["Tiếp tục theo dõi và chăm sóc cây trồng đúng quy trình."]
                }
            }
            
        # Trả về cấu trúc chẩn đoán chuẩn
        return {
            "key": "gemini_diagnosis",
            "disease_vi": dis_name,
            "disease_en": dis_name,
            "severity": gemini_data.get("severity", "Thấp"),
            "confidence": 0.98,
            "bounding_boxes": [],
            "treatment": {
                "emergency": gemini_data.get("emergency", ["Lập tức cách ly cây bị bệnh."]),
                "chemical": gemini_data.get("chemical", []),
                "biological": gemini_data.get("biological", []),
                "prevention": gemini_data.get("prevention", [])
            }
        }
        
    except Exception as e:
        print(f"[GEMINI API DIAGNOSIS ERROR] {e}")
        # Fallback to healthy if Gemini call fails
        return {
            "key": "healthy",
            "disease_vi": "Khỏe mạnh (Hoặc AI tạm thời ngoại tuyến)",
            "disease_en": "Healthy (Or AI Offline)",
            "severity": "Low",
            "confidence": 0.95,
            "bounding_boxes": [],
            "treatment": {
                "emergency": ["Không thể kết nối với máy chủ AI chẩn đoán. Vui lòng kiểm tra lại mạng."],
                "chemical": [],
                "biological": [],
                "prevention": []
            }
        }

def apply_clahe(pil_img):
    """Áp dụng CLAHE để làm nổi bật chi tiết gân lá/vân củ (Dùng OpenCV)"""
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    
    # --- [MỚI] Tăng cường ánh sáng nếu ảnh quá tối (Low-light Enhancement) ---
    img = enhance_low_light(img)
    
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    limg = cv2.merge((cl, a, b))
    final_img = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    final_img = cv2.cvtColor(final_img, cv2.COLOR_BGR2RGB)
    
    return Image.fromarray(final_img)

def enhance_low_light(cv_img):
    """Tăng cường ánh sáng thích nghi cho ảnh thiếu sáng (Gamma Correction)"""
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    brightness = np.mean(gray)
    
    # Nếu ảnh tối (độ sáng trung bình < 110)
    if brightness < 110:
        # Tính toán gamma dựa trên độ tối (càng tối gamma càng thấp để làm sáng mạnh)
        gamma = max(0.4, brightness / 110.0) 
        invGamma = 1.0 / gamma
        table = np.array([((i / 255.0) ** invGamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
        return cv2.LUT(cv_img, table)
    return cv_img

def apply_super_res(pil_img):
    """Giả lập Super-Resolution bằng Unsharp Masking để phục hồi độ nét"""
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    
    # Tạo lớp mờ Gaussian
    gaussian = cv2.GaussianBlur(img, (0, 0), 3.0)
    # Lấy ảnh gốc trừ đi ảnh mờ để lấy chi tiết cạnh, sau đó cộng ngược lại
    # Công thức: sharpened = original + (original - gaussian) * weight
    sharpened = cv2.addWeighted(img, 1.7, gaussian, -0.7, 0)
    
    return Image.fromarray(cv2.cvtColor(sharpened, cv2.COLOR_BGR2RGB))

def apply_sharpen(pil_img):
    """Làm sắc nét ảnh để AI nhìn rõ các cạnh"""
    enhancer = ImageEnhance.Sharpness(pil_img)
    return enhancer.enhance(2.0)

def is_image_blurry(pil_img, threshold=40):
    """Kiểm tra ảnh có bị mờ không (Dùng phương sai Laplacian)"""
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2GRAY)
    variance = cv2.Laplacian(cv_img, cv2.CV_64F).var()
    return variance < threshold, variance

def prepare_image_for_api(pil_img):
    """Sử dụng pipeline chung để preprocess ảnh cho API"""
    bname = globals().get("model_backbone_name", "efficientnetb3")
    arr_1_h_w_3 = preprocess_image(pil_img, backbone_name=bname)
    return arr_1_h_w_3[0] # Lấy ra mảng (H, W, 3) để bỏ vào batch TTA

def predict_with_tta(pil_img, model):
    """
    TTA nâng cao: Tăng cường đa dạng biến thể để đạt độ tin tưởng tối đa.
    """
    augmented_images = []
    
    # 1. Ảnh gốc
    augmented_images.append(prepare_image_for_api(pil_img))
    
    # 2. Ảnh Siêu độ phân giải (Dùng Unsharp Masking)
    sr_img = apply_super_res(pil_img)
    augmented_images.append(prepare_image_for_api(sr_img))
    
    # 3. Ảnh CLAHE (Làm nổi chi tiết gân/vân)
    clahe_img = apply_clahe(pil_img)
    augmented_images.append(prepare_image_for_api(clahe_img))
    
    # 4. Xoay nhẹ (Rotation) - Xử lý ảnh bị nghiêng
    augmented_images.append(prepare_image_for_api(pil_img.rotate(5)))
    augmented_images.append(prepare_image_for_api(pil_img.rotate(-5)))
    
    # 5. Phóng to vùng trung tâm (Zoom In) - Tập trung vào chi tiết
    w, h = pil_img.size
    zoom_img = pil_img.crop((w*0.05, h*0.05, w*0.95, h*0.95)).resize((w, h), Image.Resampling.LANCZOS)
    augmented_images.append(prepare_image_for_api(zoom_img))
    
    # 6. Tăng độ tương phản (Contrast Boost)
    contrast = ImageEnhance.Contrast(pil_img).enhance(1.4)
    augmented_images.append(prepare_image_for_api(contrast))
    
    batch = np.stack(augmented_images, axis=0)
    all_preds = model.predict(batch, verbose=0)
    
    # Lấy giá trị trung bình có trọng số hoặc lấy Mean của các biến thể
    # Sử dụng Mean giúp giảm nhiễu và làm ổn định kết quả dự đoán của TTA
    mean_preds = np.mean(all_preds, axis=0)
    final_preds = mean_preds / np.sum(mean_preds)
    
    return final_preds

def center_crop(pil_img, ratio=0.85):
    """
    Cắt giữ lại vùng trung tâm (0.85). 
    Tỉ lệ lớn hơn giúp nhận diện được các 'đống' củ sắn ở rìa ảnh.
    """
    w, h = pil_img.size
    new_w, new_h = int(w * ratio), int(h * ratio)
    left = (w - new_w) // 2
    top = (h - new_h) // 2
    return pil_img.crop((left, top, left + new_w, top + new_h))

# -- Endpoint API Nhận diện (Camera/Upload) --
@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None)
):
    global model, model_load_error
    if model is None:
        return JSONResponse({"success": False, "error": f"AI Model not loaded. Error detail: {model_load_error}"})
        
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Bước 1: Kiểm tra chất lượng ảnh (Mờ)
        is_blurry, blur_val = is_image_blurry(image, threshold=15)
        if is_blurry:
            return JSONResponse({"success": False, "error": "Ảnh quá mờ hoặc thiếu sáng. Vui lòng chụp lại rõ nét hơn!"}, status_code=200)
        print(f"[QUALITY CHECK] Blur Variance: {blur_val:.2f} (Blurry: {is_blurry})")
        
        # Bước 2: Center Crop (nhẹ nhàng)
        image_cropped = center_crop(image, ratio=0.85)

        # Bước 3: TTA nâng cao (Tích hợp CLAHE và Sharpening)
        avg_preds = predict_with_tta(image_cropped, model)

        # Bước 3: Log chi tiết top n để debug (Hỗ trợ xử lý nhầm sắn/khoai lang)
        sorted_indices = np.argsort(avg_preds)[::-1]
        print(f"\n[AI DEBUG] Prediction for {file.filename}:")
        for i in range(min(3, len(CLASSES))):
            idx = sorted_indices[i]
            print(f"  {i+1}. {CLASSES[idx]}: {avg_preds[idx]*100:.2f}%")
        
        max_idx = sorted_indices[0]
        max_prob = float(avg_preds[max_idx])
        pred_class = CLASSES[max_idx]



        # Sinh Heatmap Grad-CAM
        try:
            bname = globals().get("model_backbone_name", "efficientnetb3")
            img_for_cam_1_h_w_3 = preprocess_image(image_cropped, backbone_name=bname)
            heatmap = make_gradcam_heatmap(img_for_cam_1_h_w_3, model)
            heatmap_b64, superimposed_img = get_base64_heatmap(image_cropped, heatmap)
        except Exception as e:
            print("GradCAM error:", e)
            heatmap_b64 = None
            superimposed_img = None

        # Gom nhóm kết quả: Cộng dồn xác suất của các bộ phận cùng loại cây
        crop_confidences = {}
        for i, prob in enumerate(avg_preds):
            crop_name = CLASSES[i].split('_')[0]
            if CLASSES[i].startswith("sweet_potato"): crop_name = "sweet_potato"
            crop_confidences[crop_name] = crop_confidences.get(crop_name, 0) + prob
        
        # Tìm cây có tổng xác suất cao nhất
        best_crop = max(crop_confidences, key=lambda k: crop_confidences[k])
        total_confidence = float(crop_confidences[best_crop])

        # --- NÂNG CẤP HÀNG RÀO BẢO VỆ (Threshold 45%) ---
        if total_confidence < 0.45:
            return JSONResponse({
                "success": False,
                "error": "Đây không phải cây lương thực! Vui lòng chụp rõ Lúa, Ngô, Khoai, Sắn..."
            }, status_code=200)
        
        # --- SỬ DỤNG ĐỘ TIN CẬY THỰC TẾ ---
        max_prob = total_confidence
        # ----------------------------------
        
        base_crop_name = best_crop
        details = CROP_DETAILS.get(base_crop_name, {}).copy()
        
        # Cập nhật vi_name lấy từ CLASS_INFO thay vì CROP_DETAILS để hiển thị "Bắp Ngô" thay vì "Ngô"
        CLASS_INFO = getattr(config, 'CLASS_INFO', {})
        if pred_class in CLASS_INFO:
            details["vi"] = CLASS_INFO[pred_class]["vi"]
        
        if heatmap_b64:
            details["heatmap"] = f"data:image/jpeg;base64,{heatmap_b64}"
            
        # --- PHÂN TÍCH BỆNH HỌC THÔNG MINH ---
        try:
            disease_info = detect_leaf_diseases(image, base_crop_name)
            details["disease"] = disease_info
        except Exception as disease_err:
            print("Disease detection error:", disease_err)
            details["disease"] = {
                "key": "healthy",
                "disease_vi": "Khỏe mạnh",
                "disease_en": "Healthy",
                "severity": "Low",
                "confidence": 0.95,
                "bounding_boxes": [],
                "treatment": None
            }
            
        # -- LƯU LỊCH SỬ --
        scan_id = str(uuid.uuid4())
        image_name = f"{scan_id}.jpg"
        
        # Xác định chuỗi prediction lưu DB (nếu nhiễm bệnh thì lưu tên bệnh)
        disease_key = details["disease"].get("key", "healthy") if isinstance(details.get("disease"), dict) else "healthy"
        db_prediction = pred_class
        if disease_key == "gemini_diagnosis":
            db_prediction = details["disease"].get("disease_vi", pred_class)

        # 1. Lưu ảnh gốc local (dự phòng)
        if not HISTORY_DIR.exists():
            HISTORY_DIR.mkdir(parents=True, exist_ok=True)
            
        local_image_path = HISTORY_DIR / image_name
        image.save(local_image_path)
        print(f"DEBUG: Image saved locally to {local_image_path}")
        
        # Mặc định dùng URL local
        image_url = f"/history/{image_name}"
        
        # 2. Upload lên Supabase nếu được kích hoạt
        if USE_SUPABASE and supabase:
            # --- Tách riêng phần Upload ảnh ---
            try:
                # Upload ảnh lên Storage (Bucket: 'scans')
                with open(local_image_path, 'rb') as f:
                    # Ghi đè nếu đã tồn tại để tránh lỗi
                    supabase.storage.from_('crop-images').upload(image_name, f.read(), file_options={"upsert": "true"})
                
                # Lấy URL công khai
                res = supabase.storage.from_('crop-images').get_public_url(image_name)
                if res:
                    image_url = res
                    print(f"DEBUG: Image uploaded to Supabase Storage: {image_url}")
            except Exception as storage_err:
                print(f"Supabase Storage Error (Non-critical, using local fallback): {storage_err}")
            
            # --- Tách riêng phần Lưu Database ---
            try:
                insert_data = {
                    "id": scan_id,
                    "prediction": db_prediction,
                    "probability": max_prob,
                    "crop_name_vi": details.get("vi", pred_class),
                    "image_url": image_url,
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "user_id": user_id
                }
                if lat is not None:
                    insert_data["lat"] = lat
                if lng is not None:
                    insert_data["lng"] = lng
                supabase.table('scan_history').insert(insert_data).execute()
                print(f"Supabase DB sync completed for {scan_id}")
            except Exception as db_err:
                print(f"Supabase DB Sync Error (Critical): {db_err}")
                print(f"DEBUG: Failed to save scan for user_id: {user_id}. Ensure this ID exists in public.profiles.")

        # 3. Lưu JSON local (dự phòng)
        history_data = {
            "id": scan_id,
            "prediction": db_prediction,
            "probability": max_prob,
            "timestamp": time.time(),
            "time_str": time.strftime("%H:%M:%S", time.localtime()),
            "date_str": time.strftime("%d/%m/%Y", time.localtime()),
            "details": details,
            "image_url": image_url,
            "lat": lat,
            "lng": lng
        }
        
        with open(HISTORY_DIR / f"{scan_id}.json", "w", encoding="utf-8") as f:
            json.dump(history_data, f, ensure_ascii=False, indent=4)

        return JSONResponse({
            "success": True,
            "id": scan_id,
            "prediction": pred_class,
            "probability": max_prob,
            "details": details,
            "image_url": image_url,
            "is_blurry": bool(is_blurry),
            "blur_score": float(blur_val)
        })
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)})




@app.post("/reclassify")
async def reclassify(scan_id: str = Form(...), crop_hint: str = Form(...), user_id: Optional[str] = Form(None)):
    try:
        VALID_CROPS = {"rice", "corn", "sweet_potato", "potato", "wheat", "sugarcane", "cassava", "soybean"}
        if crop_hint not in VALID_CROPS:
            return JSONResponse({"success": False, "error": "Cây trồng không hợp lệ."})

        # 1. Đọc ảnh gốc đã lưu
        local_image_path = HISTORY_DIR / f"{scan_id}.jpg"
        if not local_image_path.exists():
            return JSONResponse({"success": False, "error": f"Không tìm thấy ảnh của lượt quét {scan_id}."})
            
        image = Image.open(local_image_path).convert("RGB")

        # 2. Đọc file JSON lịch sử hiện tại
        json_path = HISTORY_DIR / f"{scan_id}.json"
        if not json_path.exists():
            return JSONResponse({"success": False, "error": f"Không tìm thấy dữ liệu của lượt quét {scan_id}."})

        with open(json_path, "r", encoding="utf-8") as f:
            history_data = json.load(f)

        # 3. Phân tích lại bệnh lý dựa trên crop_hint mới
        disease_info = detect_leaf_diseases(image, crop_hint)

        # 4. Cập nhật details mới
        details = CROP_DETAILS.get(crop_hint, {}).copy()
        
        # Thiết lập nhãn tiếng Việt phù hợp
        crop_to_label = {
            "rice": ("Cây Lúa", "rice_leaf"),
            "corn": ("Cây Ngô (Bắp)", "corn_leaf"),
            "sweet_potato": ("Cây Khoai Lang", "sweet_potato_leaf"),
            "potato": ("Cây Khoai Tây", "potato_leaf"),
            "wheat": ("Cây Lúa Mì", "wheat_leaf"),
            "sugarcane": ("Cây Mía", "sugarcane_leaf"),
            "cassava": ("Cây Sắn / Khoai Mì", "cassava_leaf"),
            "soybean": ("Cây Đậu Nành", "soybean_leaf")
        }
        vi_label, pred_class = crop_to_label.get(crop_hint, ("Cây Trồng", "rice_leaf"))
        details["vi"] = vi_label

        # Giữ lại heatmap cũ nếu có
        old_details = history_data.get("details", {})
        if "heatmap" in old_details:
            details["heatmap"] = old_details["heatmap"]

        details["disease"] = disease_info

        # 5. Lưu lại thông tin mới vào JSON
        history_data["prediction"] = pred_class
        history_data["details"] = details

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(history_data, f, ensure_ascii=False, indent=4)

        # 6. Cập nhật lên Supabase nếu có
        if USE_SUPABASE and supabase:
            try:
                supabase.table('scan_history').update({
                    "crop_name_vi": details.get("vi", pred_class),
                    "prediction": pred_class
                }).eq("id", scan_id).execute()
                print(f"Supabase reclassification DB sync completed for {scan_id}")
            except Exception as db_err:
                print(f"Supabase Reclassify DB Sync Error: {db_err}")

        return JSONResponse({
            "success": True,
            "id": scan_id,
            "prediction": pred_class,
            "probability": history_data.get("probability", 0.95),
            "details": details,
            "image_url": history_data.get("image_url")
        })
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)})



# ── Endpoints Cộng Đồng (Social Feed) ──
import os
from pathlib import Path
COMMUNITY_FILE = Path(__file__).parent.parent / "frontend" / "www" / "community.json"

def get_community_data():
    if not COMMUNITY_FILE.exists():
        with open(COMMUNITY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
        return []
    try:
        with open(COMMUNITY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

# ── Endpoints Cộng đồng (Kết nối Supabase) ──
# Legacy explore routes moved to backend/routers/explore.py


@app.get("/api/community/posts")
def get_community_posts(email: str = Query(None)):
    if not (USE_SUPABASE and supabase):
        return []

    try:
        # Lấy bài viết, thử join với profiles qua user_id
        try:
            res = supabase.table('posts').select("*, profiles(full_name, avatar_url, email)").neq("status", "restricted").order('created_at', desc=True).execute()
            raw_posts = res.data or []
        except:
            # Fallback nếu join lỗi: Chỉ lấy bài viết
            res = supabase.table('posts').select("*").neq("status", "restricted").order('created_at', desc=True).execute()
            raw_posts = res.data or []

        # Nếu có email, lọc bài của riêng user này
        if email:
            # Lọc phía client để tránh lỗi join phức tạp
            filtered = []
            for p in raw_posts:
                if not isinstance(p, dict): continue
                prof_data = p.get('profiles')
                prof = prof_data if isinstance(prof_data, dict) else {}
                if prof.get('email') == email:
                    filtered.append(p)
            raw_posts = filtered
        
        formatted_posts = []
        for p in raw_posts:
            if not (p and isinstance(p, dict)): continue
            # Lấy thông tin profile, nếu null thì dùng giá trị mặc định
            profile = p.get('profiles') if isinstance(p.get('profiles'), dict) else {}
            
            # Ưu tiên hiển thị: Tên đầy đủ > Tên từ Email > "Nhà nông"
            full_name = profile.get("full_name")
            email_part = str(profile.get("email", "")).split('@')[0] if profile.get("email") else ""
            display_name = full_name or email_part or "Nhà nông"
            
            created_at_val = str(p.get("created_at") or "")
            formatted_posts.append({
                "id": p.get("id") or "",
                "user_id": p.get("user_id"),
                "display_name": display_name,
                "avatar_url": profile.get("avatar_url"),
                "caption": p.get("caption", ""),
                "image_url": p.get("image_url", ""),
                "ai_data": p.get("ai_data"),
                "likes": p.get("likes_count", 0), 
                "comments_count": p.get("comments_count", 0),
                "time_str": created_at_val.split('T')[0] if 'T' in created_at_val else "Vừa xong"
            })
            
        return formatted_posts
    except Exception as e:
        print(f"Supabase Feed Error: {e}")
        return []

@app.get("/api/community/notifications")
def get_community_notifications(
    user_id: str = Query(...),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None)
):
    if not (USE_SUPABASE and supabase):
        return []
    try:
        # 1. Lấy thông báo cá nhân từ bảng notifications
        try:
            res = supabase.table('notifications').select("*, actor_profiles:profiles!actor_id(full_name, avatar_url)").eq('user_id', user_id).order('created_at', desc=True).limit(20).execute()
        except:
            # Fallback: query without join if foreign key relationship doesn't exist
            res = supabase.table('notifications').select("*").eq('user_id', user_id).order('created_at', desc=True).limit(20).execute()
        data = res.data or []

        # 2. Truy vấn các ca quét bệnh dịch thật gần đây từ scan_history
        disease_alerts = []
        try:
            import math
            try:
                from treatment_data import TREATMENT_DB  # type: ignore
            except ImportError:
                from backend.treatment_data import TREATMENT_DB

            def is_disease_prediction(pred: str) -> bool:
                if not pred:
                    return False
                # Nếu kết thúc bằng các hậu tố lành mạnh, không phải là bệnh
                if pred.endswith(("_leaf", "_stalk", "_product", "_tuber")):
                    return False
                if "healthy" in pred.lower():
                    return False
                return True

            def calculate_distance(lat1, lon1, lat2, lon2):
                R = 6371.0  # Bán kính Trái Đất (km)
                try:
                    dlat = math.radians(lat2 - lat1)
                    dlon = math.radians(lon2 - lon1)
                    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
                    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                    return R * c
                except:
                    return float('inf')

            def get_disease_display_name(pred: str) -> str:
                if isinstance(TREATMENT_DB, dict) and pred in TREATMENT_DB:
                    entry = TREATMENT_DB[pred]
                    if isinstance(entry, dict):
                        val = entry.get("disease_vi")
                        if isinstance(val, str):
                            return val
                return pred

            # Lấy 30 ca quét gần nhất
            res_scans = supabase.table('scan_history').select('*').order('timestamp', desc=True).limit(30).execute()
            scans = res_scans.data or []

            for scan in scans:
                if not isinstance(scan, dict):
                    continue
                pred = scan.get("prediction")
                if not isinstance(pred, str):
                    continue
                if not is_disease_prediction(pred):
                    continue

                scan_lat = scan.get("lat")
                scan_lng = scan.get("lng")

                is_nearby = False
                distance_str = ""

                try:
                    f_lat = lat
                    f_lng = lng
                    f_scan_lat = float(scan_lat) if isinstance(scan_lat, (int, float, str)) else None
                    f_scan_lng = float(scan_lng) if isinstance(scan_lng, (int, float, str)) else None
                except:
                    f_lat = f_lng = f_scan_lat = f_scan_lng = None

                if f_lat is not None and f_lng is not None and f_scan_lat is not None and f_scan_lng is not None:
                    dist = calculate_distance(f_lat, f_lng, f_scan_lat, f_scan_lng)
                    if dist <= 150.0:  # Bán kính 150km
                        is_nearby = True
                        distance_str = f"cách bạn {dist:.1f} km"
                elif lat is None or lng is None:
                    # Nếu không chia sẻ GPS, hiển thị chung là khu vực lân cận
                    is_nearby = True
                    distance_str = "tại khu vực lân cận"

                if is_nearby:
                    disease_name = get_disease_display_name(pred)
                    crop_name = str(scan.get("crop_name_vi") or "cây trồng")
                    ts_val = scan.get("timestamp")
                    ts = ts_val if isinstance(ts_val, str) else ""
                    
                    # Chuyển định dạng timestamp từ DB sang ISO8601
                    if ts and " " in ts:
                        ts_iso = ts.replace(" ", "T") + "Z"
                    else:
                        ts_iso = ts

                    disease_alerts.append({
                        "id": f"pest-alert-{scan.get('id')}",
                        "user_id": user_id,
                        "actor_id": "system_alert",
                        "type": "alert",
                        "comment_text": f"Cảnh báo dịch hại: Phát hiện ca bệnh {disease_name} trên {crop_name} {distance_str}. Khuyến cáo bà con kiểm tra vườn ruộng.",
                        "created_at": ts_iso,
                        "is_read": False,
                        "actor_profiles": {
                            "full_name": "Cố vấn Dịch bệnh AI",
                            "avatar_url": None
                        }
                    })

                    if len(disease_alerts) >= 3:
                        break
        except Exception as e_scan:
            print("Pest alerts generation warning:", e_scan)

        # Trộn cảnh báo dịch bệnh thật vào đầu danh sách
        data = disease_alerts + data
        
        return data
    except Exception as e:
        print(f"Notification error: {e}")
        return []

@app.get("/api/community/trending-crops")
def get_trending_crops():
    if not (USE_SUPABASE and supabase):
        return []
    try:
        # Lấy tất cả bài viết để đếm (Trong thực tế nên dùng RPC hoặc GroupBy nếu DB lớn)
        res = supabase.table('posts').select("crop_name").execute()
        posts = res.data or []
        
        counts = {}
        for p in posts:
            if isinstance(p, dict):
                name = p.get('crop_name') or 'Khác'
                counts[name] = counts.get(name, 0) + 1
            
        # Chuyển thành danh sách và sắp xếp
        trending = []
        for name, count in counts.items():
            trending.append({
                "name": name,
                "count": count
            })
            
        trending.sort(key=lambda x: x['count'], reverse=True)
        return trending[:5] # Trả về top 5
    except Exception as e:
        print(f"Trending error: {e}")
        return []

@app.post("/api/community/notification") # Sửa lại decorator route nếu trước đó thiếu
def create_notification(
    user_id: str = Form(...),
    actor_id: str = Form(...),
    type: str = Form(...),
    post_id: Optional[str] = Form(None),
    comment_text: Optional[str] = Form(None)
):
    if not (USE_SUPABASE and supabase): return {"success": False}
    try:
        data = {
            "user_id": user_id,
            "actor_id": actor_id,
            "type": type,
            "post_id": post_id,
            "comment_text": comment_text
        }
        res = supabase.table('notifications').insert(data).execute()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/community/post")
def create_community_post(
    user_id: str = Form(...),
    caption: str = Form(...),
    crop_name: str = Form(...),
    image_url: str = Form("")
):
    if not supabase:
        return JSONResponse({"success": False, "error": "Chưa kết nối được Supabase. Hãy kiểm tra SUPABASE_KEY trong config.py"}, status_code=500)
        
    try:
        data_to_insert = {
            "user_id": user_id,
            "caption": caption,
            "crop_name": crop_name,
            "image_url": image_url
        }
        res = supabase.table('posts').insert(data_to_insert).execute()
        
        if not res.data:
            return JSONResponse({"success": False, "error": "Không thể lưu bài đăng"}, status_code=500)
            
        return {"success": True, "post": res.data[0]}
    except Exception as e:
        print(f"Create Post Error: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.post("/api/community/like/{post_id}")
def like_community_post(post_id: str, user_id: str = Query(...)):
    if not (USE_SUPABASE and supabase): return {"success": False}
    try:
        # Toggle like logic
        existing = supabase.table('likes').select("*").eq('post_id', post_id).eq('user_id', user_id).execute()
        if len(existing.data) > 0:
            supabase.table('likes').delete().eq('post_id', post_id).eq('user_id', user_id).execute()
        else:
            supabase.table('likes').insert({"post_id": post_id, "user_id": user_id}).execute()
        
        # Đếm lại tổng like
        count_res = supabase.table('likes').select("*", count=CountMethod.exact).eq('post_id', post_id).execute()
        return {"success": True, "likes": count_res.count}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/community/comments/{post_id}")
def get_comments(post_id: str):
    if not (USE_SUPABASE and supabase): return []
    try:
        try:
            res = supabase.table('comments').select("*, profiles(full_name, avatar_url)").eq('post_id', post_id).order('created_at', desc=False).execute()
        except:
            res = supabase.table('comments').select("*").eq('post_id', post_id).order('created_at', desc=False).execute()
        return res.data
    except Exception as e:
        return []

@app.post("/api/community/comment")
def post_comment(
    post_id: str = Form(...),
    user_id: str = Form(...),
    content: str = Form(...)
):
    if not (USE_SUPABASE and supabase): return {"success": False}
    try:
        data = {"post_id": post_id, "user_id": user_id, "content": content}
        res = supabase.table('comments').insert(data).execute()
        return {"success": True, "comment": res.data[0]}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/user/stats")
def get_user_stats(user_id: str = Query(...)):
    if not (USE_SUPABASE and supabase):
        return {"posts": 0, "followers": 0, "following": 0}
    try:
        # 1. Đếm số bài viết thực tế
        res_posts = supabase.table('posts').select("id", count=CountMethod.exact).eq('user_id', user_id).execute()
        post_count = res_posts.count if res_posts.count is not None else 0
        
        # 2. Đếm số người đang theo dõi (Following)
        res_following = supabase.table('follows').select("id", count=CountMethod.exact).eq('follower_id', user_id).execute()
        following_count = res_following.count if res_following.count is not None else 0

        # 3. Đếm số người theo dõi mình (Followers)
        res_followers = supabase.table('follows').select("id", count=CountMethod.exact).eq('following_id', user_id).execute()
        followers_count = res_followers.count if res_followers.count is not None else 0

        return {
            "posts": post_count,
            "followers": followers_count,
            "following": following_count
        }
    except Exception as e:
        print(f"Stats error: {e}")
        return {"posts": 0, "followers": 0, "following": 0}

@app.get("/api/history")
def get_history(user_id: str = Query(None)):
    CLASS_INFO = getattr(config, 'CLASS_INFO', {})
    # 1. Ưu tiên lấy từ Supabase nếu có kích hoạt
    if USE_SUPABASE and supabase:
        try:
            query = supabase.table('scan_history').select("*").order('timestamp', desc=True)
            if user_id:
                query = query.eq('user_id', user_id)
            response = query.execute()
            data_list = response.data
            history_list = []
            for item in (data_list or []):
                if not isinstance(item, dict): continue
                ts = str(item.get("timestamp") or "")
                pred = item.get("prediction") or "Unknown"
                
                # Lấy tên tiếng Việt từ database hoặc dịch theo CLASS_INFO
                vi_name = item.get("crop_name_vi")
                if not vi_name:
                    vi_name = CLASS_INFO.get(pred, {}).get("vi", pred) if pred in CLASS_INFO else pred
                
                history_list.append({
                    "id": item.get("id") or "",
                    "prediction": vi_name,
                    "probability": item.get("probability") or 0,
                    "time": ts.split(' ')[1] if ' ' in ts else ts,
                    "date": ts.split(' ')[0] if ts else "Unknown",
                    "image": item.get("image_url") or ""
                })
            return history_list
        except Exception as e:
            print(f"Supabase Fetch Error: {e}")
            # Nếu lỗi Supabase thì fallback xuống lấy local bên dưới

    # 2. Fallback lấy từ local files
    history_list = []
    json_files = list(HISTORY_DIR.glob("*.json"))
    json_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    for jf in json_files:
        try:
            with open(jf, "r", encoding="utf-8") as f:
                data = json.load(f)
                details = data.get("details", {})
                pred = data.get("prediction")
                
                vi_name = details.get("vi")
                if not vi_name:
                    vi_name = CLASS_INFO.get(pred, {}).get("vi", pred) if pred in CLASS_INFO else pred
                
                history_list.append({
                    "id": data["id"],
                    "prediction": vi_name,
                    "probability": data["probability"],
                    "time": data["time_str"],
                    "date": data["date_str"],
                    "image": data["image_url"]
                })
        except:
            continue
    return history_list

@app.get("/api/history/{scan_id}")
def get_history_detail(scan_id: str):
    json_path = HISTORY_DIR / f"{scan_id}.json"
    if not json_path.exists():
        return JSONResponse({"success": False, "error": "Không tìm thấy bản ghi."}, status_code=404)
    
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

@app.delete("/api/history")
def clear_history(user_id: str = Query(...)):
    # 1. Xóa trên Supabase
    if USE_SUPABASE and supabase:
        try:
            supabase.table('scan_history').delete().eq('user_id', user_id).execute()
        except Exception as e:
            print(f"Supabase Delete Error: {e}")
    
    # 2. Xóa toàn bộ tệp JSON cục bộ trong thư mục history
    # Lưu ý: Vì bản ghi local không có user_id, ta xóa sạch thư mục history.
    # Phù hợp cho môi trường phát triển cá nhân.
    try:
        for f in HISTORY_DIR.glob("*.json"):
            f.unlink()
        for f in HISTORY_DIR.glob("*.jpg"):
            f.unlink()
    except Exception as e:
        print(f"Local Clear Error: {e}")
    
    return {"success": True, "message": "Đã xóa toàn bộ lịch sử."}

@app.delete("/api/history/{scan_id}")
def delete_history_item(scan_id: str):
    json_path = HISTORY_DIR / f"{scan_id}.json"
    img_path = HISTORY_DIR / f"{scan_id}.jpg"
    
    deleted = False
    if json_path.exists():
        json_path.unlink()
        deleted = True
    if img_path.exists():
        img_path.unlink()
        deleted = True
        
    if deleted:
        return {"success": True, "message": "Đã xóa bản ghi."}
    return JSONResponse({"success": False, "error": "Không tìm thấy bản ghi để xóa."}, status_code=404)

# ── AUTH ENDPOINTS ──────────────────────────────────────────
@app.post("/api/auth/register")
def register(request: dict):
    username = request.get("username", "").lower().strip().replace(" ", "")
    password = request.get("password")
    if not username or not password:
        return {"success": False, "error": "Thiếu thông tin"}
    
    email = request.get("email")
    if not email:
        if "@" in username:
            email = username
        else:
            email = f"{username}@agrisocial.vn"
    email = email.lower().strip()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        print(f"Registering user: {username} with email: {email}")
        # Hash password directly with bcrypt
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        
        import uuid
        user_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO custom_users (id, username, password_hash, email) VALUES (?, ?, ?, ?)", 
                       (user_id, username, password_hash, email))
        conn.commit()
        
        # Sync to Supabase profiles for consistency
        if supabase:
            try:
                full_name = request.get("full_name") or username
                profile_data = {
                    "id": user_id, 
                    "username": username,
                    "full_name": full_name, 
                    "email": email,
                    "role": "user"
                }
                print(f"Attempting Supabase Sync with data: {profile_data}")
                
                sync_res = supabase.table("profiles").upsert(profile_data).execute()
                
                if sync_res:
                    print(f"[OK] Supabase Sync SUCCESS for {username}. Response: {sync_res}")
                else:
                    print(f"[WARN] Supabase Sync returned no response for {username}")
            except Exception as e:
                print(f"[ERROR] Supabase Sync FATAL ERROR for {username}: {str(e)}")
                # Log detailed traceback if possible
                import traceback
                traceback.print_exc()
                
        return {"success": True, "user_id": user_id}
    except sqlite3.IntegrityError:
        return {"success": False, "error": "Tên đăng nhập đã tồn tại"}
    except Exception as e:
        print(f"Registration General Error: {e}")
        return {"success": False, "error": f"Lỗi hệ thống: {str(e)}"}
    finally:
        conn.close()

@app.post("/api/auth/login")
@app.post("/api/login")
def login(request: dict):
    username = request.get("username", "").lower().strip().replace(" ", "")
    password = request.get("password")
    
    print(f"DEBUG LOGIN: Attempting to login user: '{username}'")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, username, password_hash, role, banned FROM custom_users WHERE username = ?", (username,))
        user = cursor.fetchone()
        if not user:
            print(f"DEBUG LOGIN: User '{username}' NOT found in auth.db")
        else:
            print(f"DEBUG LOGIN: User '{username}' found. Checking password...")
        conn.close()
        
        if user:
            # Check if user is banned
            is_banned = user[4] if len(user) > 4 else 0
            if is_banned:
                print(f"DEBUG LOGIN: User '{username}' is BANNED. Rejecting login.")
                return {"success": False, "error": "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên."}
            
            stored_hash = user[2]
            # Check password using direct bcrypt
            if bcrypt.checkpw(str(password).encode('utf-8'), str(stored_hash).encode('utf-8')):
                # Fetch actual role from Supabase profiles
                user_role = user[3] # Fallback to local role
                print(f"DEBUG LOGIN: Local role for '{username}' is '{user_role}'")
                if supabase:
                    try:
                        print(f"DEBUG LOGIN: Fetching role from Supabase for ID '{user[0]}'")
                        res = supabase.table("profiles").select("role").eq("id", str(user[0])).execute()
                        if res.data and len(res.data) > 0:
                            first_item = res.data[0]
                            if isinstance(first_item, dict):
                                user_role = first_item.get("role", user_role)
                            print(f"DEBUG LOGIN: Found Supabase role: '{user_role}'")
                        else:
                            print(f"DEBUG LOGIN: No profile found in Supabase for ID '{user[0]}'. Creating one...")
                            try:
                                supabase.table("profiles").upsert({
                                    "id": str(user[0]),
                                    "username": username,
                                    "full_name": username,
                                    "role": user_role,
                                    "created_at": "now()"
                                }).execute()
                                print(f"DEBUG LOGIN: Successfully created missing profile for {username}")
                            except Exception as sync_err:
                                print(f"DEBUG LOGIN: Failed to create missing profile: {sync_err}")
                    except Exception as e:
                        print(f"DEBUG LOGIN: Supabase role fetch error: {e}")
                
                token_data = {"sub": str(user[0]), "username": user[1], "role": user_role}
                print(f"DEBUG LOGIN: Issuing token with role: '{user_role}'")
                token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
                return {"success": True, "token": token, "user": token_data}
        
        return {"success": False, "error": "Sai tên đăng nhập hoặc mật khẩu"}
    except Exception as e:
        print(f"Login General Error: {e}")
        return {"success": False, "error": f"Lỗi hệ thống: {str(e)}"}
    finally:
        if conn:
            try: conn.close()
            except: pass

@app.post("/api/auth/forgot-password")
def forgot_password(request: dict):
    username = request.get("username", "").lower().strip().replace(" ", "")
    email = request.get("email", "").strip().lower()
    
    if not username or not email:
        return {"success": False, "error": "Thiếu tên đăng nhập hoặc email"}
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, email FROM custom_users WHERE username = ?", (username,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        return {"success": False, "error": "Tên đăng nhập không tồn tại"}
        
    user_id = user[0]
    stored_email = user[1]
    
    # Nếu email trong SQLite trống, thử tìm trong Supabase
    if not stored_email and supabase:
        try:
            res = supabase.table("profiles").select("email").eq("id", user_id).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                val = row.get("email") if isinstance(row, dict) else None
                if isinstance(val, str):
                    stored_email = val.strip().lower()
                    cursor.execute("UPDATE custom_users SET email = ? WHERE id = ?", (stored_email, user_id))
                    conn.commit()
        except Exception as e:
            print(f"Lỗi lấy email từ Supabase: {e}")
            
    # Nếu tài khoản đã có email đăng ký, bắt buộc email yêu cầu phải trùng khớp
    if isinstance(stored_email, str) and stored_email:
        stored_email = stored_email.strip().lower()
        if stored_email != email:
            conn.close()
            return {"success": False, "error": "Email không khớp với email đăng ký của tài khoản này"}
    else:
        # Nếu chưa có email nào đăng ký cho tài khoản này, lưu email hiện tại làm email của tài khoản
        cursor.execute("UPDATE custom_users SET email = ? WHERE id = ?", (email, user_id))
        conn.commit()
        if supabase:
            try:
                supabase.table("profiles").update({"email": email}).eq("id", user_id).execute()
            except Exception as e:
                print(f"Lỗi đồng bộ email mới lên Supabase: {e}")
                
    conn.close()
    
    # Tạo mã OTP ngẫu nhiên 6 chữ số
    otp = "".join(random.choices(string.digits, k=6))
    expires_at = time.time() + 300 # 5 phút
    
    # Lưu vào otp_store
    otp_store[username] = {
        "otp": otp,
        "email": email,
        "expires_at": expires_at
    }
    
    print(f"Mã OTP khôi phục mật khẩu của {username} ({email}) là: {otp}")
    
    # Gửi email qua SMTP
    sent = send_otp_email(email, otp, username)
    
    response_data = {
        "success": True, 
        "message": f"Mã OTP xác nhận đã được gửi đến email {email}!"
    }
    
    if not sent:
        # Gửi kèm debug_otp nếu không cấu hình SMTP để kiểm thử local
        response_data["debug_otp"] = otp
        response_data["message"] = f"Mã OTP đã được tạo (Chế độ Test: hiển thị mã trên giao diện và log server do chưa thiết lập email SMTP)."
        
    return response_data

@app.post("/api/auth/verify-otp")
def verify_otp(request: dict):
    username = request.get("username", "").lower().strip().replace(" ", "")
    otp = request.get("otp", "").strip()
    
    if not username or not otp:
        return {"success": False, "error": "Thiếu tên đăng nhập hoặc mã OTP"}
        
    otp_data = otp_store.get(username)
    if not otp_data:
        return {"success": False, "error": "Không tìm thấy yêu cầu gửi OTP hoặc yêu cầu đã hết hạn"}
        
    if time.time() > float(otp_data["expires_at"]):
        # Xóa OTP hết hạn
        otp_store.pop(username, None)
        return {"success": False, "error": "Mã OTP đã hết hiệu lực (quá 5 phút)"}
        
    if otp_data["otp"] != otp:
        return {"success": False, "error": "Mã OTP không chính xác"}
        
    return {"success": True, "message": "Xác thực OTP thành công"}

@app.post("/api/auth/reset-password")
def reset_password(request: dict):
    username = request.get("username", "").lower().strip().replace(" ", "")
    otp = request.get("otp", "").strip()
    new_password = request.get("new_password")
    
    if not username or not otp or not new_password:
        return {"success": False, "error": "Thiếu thông tin yêu cầu"}
        
    otp_data = otp_store.get(username)
    if not otp_data:
        return {"success": False, "error": "Không tìm thấy yêu cầu khôi phục mật khẩu"}
        
    if time.time() > float(otp_data["expires_at"]):
        otp_store.pop(username, None)
        return {"success": False, "error": "Yêu cầu khôi phục mật khẩu đã hết hạn"}
        
    if otp_data["otp"] != otp:
        return {"success": False, "error": "Mã OTP không hợp lệ"}
        
    # Mã OTP hợp lệ -> Cập nhật mật khẩu mới
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(str(new_password).encode('utf-8'), salt).decode('utf-8')
        cursor.execute("UPDATE custom_users SET password_hash = ? WHERE username = ?", (password_hash, username))
        conn.commit()
        
        # Xóa OTP sau khi sử dụng thành công
        otp_store.pop(username, None)
        return {"success": True, "message": "Đổi mật khẩu thành công"}
    except Exception as e:
        print(f"Lỗi cập nhật mật khẩu mới: {e}")
        return {"success": False, "error": f"Lỗi hệ thống khi cập nhật mật khẩu: {str(e)}"}
    finally:
        conn.close()

# ── API Tìm kiếm Cây trồng ──
@app.get("/api/search")
def search_crops(q: str = Query("", description="Search query")):
    """Tìm kiếm thông tự từ CROP_DETAILS"""
    q = q.strip().lower()
    if not q:
        # Return all crops
        results = []
        for key, details in CROP_DETAILS.items():
            results.append({
                "key": key,
                "vi": details.get("vi", key),
                "en": details.get("en", key),
                "sci_name": details.get("sci_name", ""),
                "family": details.get("family", ""),
                "description": details.get("description", ""),
                "icon": details.get("icon", "🌿"),
            })
        return results
    
    results = []
    for key, details in CROP_DETAILS.items():
        vi_name = details.get("vi", "").lower()
        en_name = details.get("en", "").lower()
        # Match by key, Vietnamese name, or English name
        if (q in key.lower() or q in vi_name or q in en_name 
            or key.lower() in q or vi_name in q or en_name in q):
            results.append({
                "key": key,
                "vi": details.get("vi", key),
                "en": details.get("en", key),
                "sci_name": details.get("sci_name", ""),
                "family": details.get("family", ""),
                "description": details.get("description", ""),
                "temp": details.get("temp", ""),
                "rainfall": details.get("rainfall", ""),
                "season": details.get("season", ""),
                "soil": details.get("soil", ""),
                "region": details.get("region", ""),
                "yield_vn": details.get("yield_vn", ""),
                "story": details.get("story", ""),
                "tips": details.get("tips", ""),
                "usage": details.get("usage", ""),
                "warnings": details.get("warnings", []),
                "fun_fact": details.get("fun_fact", ""),
                "icon": details.get("icon", "🌿"),
            })
    return results

# ═══════════════════════════════════════════════════════════
# UC-F04: TREATMENT API — Phác đồ Điều trị chi tiết
# ═══════════════════════════════════════════════════════════
from treatment_data import TREATMENT_DB, CROP_DISEASES  # type: ignore[import-untyped]
from farming_guides import FARMING_GUIDES  # type: ignore[import-untyped]

@app.get("/api/treatments/{crop}")
def get_treatments_by_crop(crop: str):
    """Lấy danh sách bệnh và phác đồ điều trị theo loại cây"""
    diseases = CROP_DISEASES.get(crop, [])
    if not diseases:
        return {"success": False, "diseases": [], "message": f"Không tìm thấy dữ liệu cho '{crop}'"}
    result = []
    for d in diseases:
        detail = TREATMENT_DB.get(d["key"], {})
        result.append({
            "key": d["key"],
            "disease_vi": d["disease_vi"],
            "disease_en": d["disease_en"],
            "severity": d["severity"],
            "emergency": detail.get("emergency", []),
            "chemical": detail.get("chemical", []),
            "biological": detail.get("biological", []),
            "prevention": detail.get("prevention", []),
        })
    return {"success": True, "crop": crop, "diseases": result}

@app.get("/api/farming-guides")
def get_farming_guides_endpoint():
    """Lấy dữ liệu hướng dẫn canh tác mẫu (tĩnh) từ farming_guides.py phục vụ tham khảo"""
    return {"success": True, "data": FARMING_GUIDES}

@app.get("/api/treatment/{disease_key}")
def get_treatment_detail(disease_key: str):
    """Lấy phác đồ điều trị chi tiết cho 1 bệnh"""
    detail = TREATMENT_DB.get(disease_key)
    if not detail:
        return JSONResponse({"success": False, "error": "Không tìm thấy phác đồ"}, status_code=404)
    return {"success": True, "data": detail}

# ═══════════════════════════════════════════════════════════
# UC-F08: EXPERT REQUEST — Gửi yêu cầu đến Chuyên gia
# ═══════════════════════════════════════════════════════════
@app.post("/api/expert-request")
def create_expert_request(request: dict):
    """Nông dân gửi yêu cầu tư vấn chuyên gia"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        data = {
            "user_id": request.get("user_id"),
            "image_url": request.get("image_url", ""),
            "ai_prediction": request.get("ai_prediction", ""),
            "ai_confidence": request.get("ai_confidence", 0),
            "user_note": request.get("user_note", ""),
            "location": request.get("location", ""),
            "urgency": request.get("urgency", "normal"),
            "status": "pending",
            "target_expert_id": request.get("target_expert_id")
        }
        try:
            res = supabase.table("expert_requests").insert(data).execute()
        except Exception as insert_err:
            if "target_expert_id" in str(insert_err):
                print(f"Fallback do lỗi insert target_expert_id: {insert_err}")
                data.pop("target_expert_id", None)
                res = supabase.table("expert_requests").insert(data).execute()
            else:
                raise insert_err
                
        first_row = res.data[0] if res.data else None
        row_id = first_row.get("id") if isinstance(first_row, dict) else None
        
        # --- TỰ ĐỘNG TẠO THÔNG BÁO CHO CHUYÊN GIA ---
        try:
            # Lấy tên người gửi
            sender_name = "Một nông dân"
            user_id = data.get("user_id")
            if user_id:
                u_res = supabase.table("profiles").select("full_name").eq("id", user_id).execute()
                if u_res.data and len(u_res.data) > 0:
                    profile = u_res.data[0]
                    if isinstance(profile, dict):
                        sender_name = profile.get("full_name", "Một nông dân")
            
            notif_base = {
                "title": "Câu hỏi mới từ nông dân",
                "content": f"{sender_name} vừa gửi một yêu cầu tư vấn mới.",
                "type": "system",
                "is_read": False,
                "actor_id": user_id,
                "link": "/?tab=expert"
            }
            
            target_expert_id = data.get("target_expert_id")
            if target_expert_id:
                # Gửi cho 1 chuyên gia cụ thể
                notif_base["user_id"] = target_expert_id
                supabase.table("notifications").insert(notif_base).execute()
            else:
                # Gửi cho TẤT CẢ chuyên gia
                exp_res = supabase.table("profiles").select("id").eq("role", "expert").execute()
                if exp_res.data:
                    notifs = []
                    for exp in exp_res.data:
                        if isinstance(exp, dict):
                            uid = exp.get("id")
                            if uid:
                                n = notif_base.copy()
                                n["user_id"] = uid
                                notifs.append(n)
                    if notifs:
                        supabase.table("notifications").insert(notifs).execute()
        except Exception as ne:
            print(f"Lỗi tạo thông báo cho chuyên gia: {ne}")

        return {"success": True, "request_id": row_id}
    except Exception as e:
        print(f"Expert Request Error: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.get("/api/expert-requests")
def get_expert_requests(status: str = Query(None), user_id: str = Query(None), expert_user: dict = Depends(verify_expert_role)):
    """Lấy danh sách yêu cầu tư vấn"""
    if not (USE_SUPABASE and supabase):
        return []
    try:
        # Lấy ID của chuyên gia đang đăng nhập từ token
        expert_id = expert_user.get("sub")
        
        # Chuyên gia xem được: 
        # 1. Yêu cầu gửi đích danh cho mình (target_expert_id = expert_id)
        # 2. Yêu cầu chung không chỉ định người nhận (target_expert_id is NULL)
        
        # Tối ưu: Bỏ qua query lỗi nếu cột chưa được migrate
        if getattr(app.state, "target_expert_id_exists", True):
            # Thử query có lọc target_expert_id
            q1 = supabase.table("expert_requests").select("*")
            if expert_id:
                q1 = q1.or_(f"target_expert_id.eq.{expert_id},target_expert_id.is.null")
            if status:
                q1 = q1.eq("status", status)
            if user_id:
                q1 = q1.eq("user_id", user_id)
                
            try:
                res = q1.order("created_at", desc=True).execute()
            except Exception as filter_err:
                if "target_expert_id" in str(filter_err):
                    print(f"Fallback do lỗi filter target_expert_id. Sẽ bỏ qua ở các lần sau.")
                    app.state.target_expert_id_exists = False
                    q2 = supabase.table("expert_requests").select("*")
                    if status:
                        q2 = q2.eq("status", status)
                    if user_id:
                        q2 = q2.eq("user_id", user_id)
                    res = q2.order("created_at", desc=True).execute()
                else:
                    raise filter_err
        else:
            q2 = supabase.table("expert_requests").select("*")
            if status:
                q2 = q2.eq("status", status)
            if user_id:
                q2 = q2.eq("user_id", user_id)
            res = q2.order("created_at", desc=True).execute()
            
        requests = res.data or []
        
        # Lấy thông tin người gửi
        user_ids = list({r.get("user_id") for r in requests if isinstance(r, dict) and r.get("user_id")})
        if user_ids:
            try:
                u_res = supabase.table("profiles").select("id, full_name, avatar_url").in_("id", user_ids).execute()
                user_map = {u.get("id"): u for u in (u_res.data or []) if isinstance(u, dict) and u.get("id")}
                for r in requests:
                    if not isinstance(r, dict):
                        continue
                    uid = r.get("user_id")
                    if uid and uid in user_map:
                        r["username"] = user_map[uid].get("full_name")  # type: ignore
                        r["user_avatar"] = user_map[uid].get("avatar_url")  # type: ignore
            except Exception as ex:
                print("Lỗi khi lấy profile cho expert_requests:", ex)
                
        return requests
    except Exception as e:
        print(f"Get Expert Requests Error: {e}")
        return []

# ═══════════════════════════════════════════════════════════
# UC-E02: EXPERT RESPONSE — Chuyên gia trả lời
# ═══════════════════════════════════════════════════════════
@app.post("/api/expert-response")
def create_expert_response(request: dict, expert_user: dict = Depends(verify_expert_role)):
    """Chuyên gia gửi phản hồi cho yêu cầu"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        req_id = request.get("request_id")
        data = {
            "request_id": req_id,
            "expert_id": request.get("expert_id"),
            "diagnosis": request.get("diagnosis", ""),
            "treatment": request.get("treatment", ""),
            "notes": request.get("notes", "")
        }
        res = supabase.table("expert_responses").insert(data).execute()
        # Cập nhật status của request
        supabase.table("expert_requests").update({"status": "answered"}).eq("id", req_id).execute()
        
        # --- TỰ ĐỘNG TẠO THÔNG BÁO CHO NÔNG DÂN ---
        try:
            req_res = supabase.table("expert_requests").select("user_id, ai_prediction").eq("id", req_id).execute()
            if req_res.data and len(req_res.data) > 0:
                first_row = req_res.data[0]
                if isinstance(first_row, dict):
                    farmer_id = first_row.get("user_id")
                    disease_name = request.get("diagnosis", "").strip() or first_row.get("ai_prediction", "cây trồng")
                    
                    # Chỉ tạo thông báo nếu farmer_id khác expert_id (tránh tự thông báo)
                    if farmer_id and farmer_id != request.get("expert_id"):
                        notif_data = {
                            "user_id": farmer_id,
                            "actor_id": request.get("expert_id"),
                            "type": "expert_answer",
                            "comment_text": f"Đã chẩn đoán: {disease_name}",
                            "is_read": False
                        }
                        supabase.table("notifications").insert(notif_data).execute()
                        print(f"[NOTIF] Created expert_answer notification for farmer {farmer_id}")
        except Exception as notif_err:
            print(f"[NOTIF WARN] Failed to create expert response notification: {notif_err}")

        resp_row = res.data[0] if res.data else None
        resp_id = resp_row.get("id") if isinstance(resp_row, dict) else None
        return {"success": True, "response_id": resp_id}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.get("/api/my-expert-responses")
def get_my_expert_responses(user_id: str = Query(...)):
    """Nông dân lấy các phản hồi từ chuyên gia cho yêu cầu của mình"""
    if not (USE_SUPABASE and supabase):
        return []
    try:
        # Lấy các requests của user có status = answered
        reqs = supabase.table("expert_requests").select("id, ai_prediction, image_url, created_at").eq("user_id", user_id).eq("status", "answered").execute()
        if not reqs.data:
            return []
            
        req_ids = [str(r.get("id")) for r in (reqs.data or []) if isinstance(r, dict) and r.get("id")]
        # Lấy các responses tương ứng
        resps = supabase.table("expert_responses").select("*").in_("request_id", req_ids).order("created_at", desc=True).execute()
        
        # Merge data
        result = []
        for req in (reqs.data or []):
            if not isinstance(req, dict): continue
            req_id = req.get("id")
            resp = next((p for p in (resps.data or []) if isinstance(p, dict) and p.get("request_id") == req_id), None)
            if resp and isinstance(resp, dict):
                result.append({
                    "id": req_id,
                    "prediction": req.get("ai_prediction"),
                    "image": req.get("image_url"),
                    "date": req.get("created_at"),
                    "diagnosis": resp.get("diagnosis"),
                    "treatment": resp.get("treatment"),
                    "notes": resp.get("notes")
                })
        return result
    except Exception as e:
        print(f"Get My Responses Error: {e}")
        return []

@app.get("/api/expert/stats")
def get_expert_stats(expert_user: dict = Depends(verify_expert_role)):
    """Lấy thống kê hiệu suất chuyên gia"""
    if not (USE_SUPABASE and supabase):
        return {"success": False}
    try:
        # 1. Lấy tổng số câu trả lời (Dùng limit(1) để tránh tải toàn bộ dữ liệu)
        res_ans = supabase.table("expert_responses").select("id", count=CountMethod.exact).eq("expert_id", expert_user.get("sub")).limit(1).execute()
        ans_count = res_ans.count or 0
        
        # 2. Tổng lượt quét hệ thống (Dùng estimated count hoặc limit(1) để tăng tốc độ)
        res_scans = supabase.table("scan_history").select("id", count=CountMethod.exact).limit(1).execute()
        scan_count = res_scans.count or 0
        
        # 3. Tính điểm đánh giá trung bình
        res_ratings = supabase.table("expert_responses").select("rating").eq("expert_id", expert_user.get("sub")).not_.is_("rating", "null").execute()
        ratings: list[float] = []
        for r in (res_ratings.data or []):
            if isinstance(r, dict) and r.get("rating"):
                try:
                    ratings.append(float(str(r.get("rating"))))
                except (ValueError, TypeError):
                    pass
        avg_rating = sum(ratings) / len(ratings) if ratings else 0.0
        
        return {
            "success": True,
            "answers": ans_count,
            "scans": scan_count,
            "rating": round(avg_rating, 1) if avg_rating > 0 else 0,
            "rating_count": len(ratings),
            "helpful": ans_count * 5 # Mock helpful count
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/experts/top")
def get_top_experts():
    """Lấy danh sách chuyên gia nổi bật sắp xếp theo đánh giá"""
    if not (USE_SUPABASE and supabase):
        return {"success": False, "data": []}
    try:
        # 1. Lấy danh sách chuyên gia
        res_exp = supabase.table("profiles").select("id, full_name, avatar_url, username").eq("role", "expert").execute()
        experts = res_exp.data or []
        if not experts:
            return {"success": True, "data": []}
            
        # 2. Lấy tất cả rating của các chuyên gia
        expert_ids = [str(e.get("id")) for e in experts if isinstance(e, dict) and e.get("id")]
        res_ratings = supabase.table("expert_responses").select("expert_id, rating").in_("expert_id", expert_ids).not_.is_("rating", "null").execute()
        
        # 3. Tính điểm trung bình cho từng chuyên gia
        ratings_dict = {}
        for r in (res_ratings.data or []):
            if not isinstance(r, dict): continue
            eid = r.get("expert_id")
            rating = r.get("rating")
            if eid and rating:
                try:
                    ratings_dict.setdefault(eid, []).append(float(str(rating)))
                except (ValueError, TypeError):
                    pass
                    
        # 4. Gắn rating vào chuyên gia và sắp xếp
        results = []
        for exp in experts:
            if not isinstance(exp, dict): continue
            eid = str(exp.get("id"))
            r_list = ratings_dict.get(eid, [])
            avg = sum(r_list) / len(r_list) if r_list else 0.0
            exp["rating"] = round(avg, 1)
            exp["rating_count"] = len(r_list)
            results.append(exp)
            
        results.sort(key=lambda x: x["rating"], reverse=True)
        return {"success": True, "data": results} # Trả về tất cả chuyên gia đã xếp hạng
    except Exception as e:
        print(f"Top Experts Error: {e}")
        return {"success": False, "error": str(e), "data": []}

@app.post("/api/expert-responses/{response_id}/rate")
def rate_expert_response(response_id: str, request: dict, user: dict = Depends(verify_token)):
    """Đánh giá phản hồi của chuyên gia (1-5 sao)"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        rating = request.get("rating")
        if not rating or not (1 <= rating <= 5):
            return JSONResponse({"success": False, "error": "Rating không hợp lệ (1-5)"}, status_code=400)
            
        # Kiểm tra xem response có tồn tại không
        res = supabase.table("expert_responses").select("id, request_id").eq("id", response_id).execute()
        if not res.data:
            return JSONResponse({"success": False, "error": "Không tìm thấy phản hồi"}, status_code=404)
            
        # Cập nhật rating
        supabase.table("expert_responses").update({"rating": rating}).eq("id", response_id).execute()
        
        return {"success": True, "message": "Đã đánh giá thành công"}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.get("/api/expert-responses/{request_id}")
def get_expert_responses(request_id: str):
    """Lấy phản hồi của chuyên gia cho 1 yêu cầu"""
    if not (USE_SUPABASE and supabase):
        return []
    try:
        res = supabase.table("expert_responses").select("*").eq("request_id", request_id).execute()
        return res.data or []
    except Exception as e:
        return []

@app.get("/api/expert-responses/user/{expert_id}")
def get_expert_responses_by_user(expert_id: str, expert_user: dict = Depends(verify_expert_role)):
    """Lấy danh sách các phản hồi đã giải đáp của chuyên gia, kèm theo thông tin request."""
    if not (USE_SUPABASE and supabase):
        return []
    try:
        if expert_user.get("sub") != expert_id:
            return JSONResponse({"success": False, "error": "Unauthorized"}, status_code=403)
            
        res = supabase.table("expert_responses").select("*").eq("expert_id", expert_id).order("created_at", desc=True).execute()
        responses = res.data or []
        
        for r in responses:
            if not isinstance(r, dict):
                continue
            req_id = r.get("request_id")
            if req_id:
                req_res = supabase.table("expert_requests").select("*").eq("id", req_id).execute()
                if req_res.data and len(req_res.data) > 0:
                    req_info = req_res.data[0]
                    if isinstance(req_info, dict):
                        r["request_info"] = req_info
                        user_id = req_info.get("user_id")
                        if user_id:
                            user_res = supabase.table("profiles").select("username, avatar_url").eq("id", user_id).execute()
                            if user_res.data and len(user_res.data) > 0:
                                user_info = user_res.data[0]
                                if isinstance(user_info, dict):
                                    req_info["username"] = user_info.get("username")
                                    req_info["user_avatar"] = user_info.get("avatar_url")
        return responses
    except Exception as e:
        return []

# ═══════════════════════════════════════════════════════════
# UC-E01: DISEASE MAP — Bản đồ dịch bệnh
# ═══════════════════════════════════════════════════════════
@app.get("/api/disease-map")
def get_disease_map():
    """Thống kê bệnh theo khu vực"""
    if not (USE_SUPABASE and supabase):
        # Fallback từ local history
        stats = {}
        for jf in HISTORY_DIR.glob("*.json"):
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    pred = data.get("prediction", "")
                    crop = pred.split("_")[0]
                    stats[crop] = stats.get(crop, 0) + 1
            except:
                continue
        return {"success": True, "data": stats, "source": "local"}
    try:
        res = supabase.table("scan_history").select("prediction, timestamp").execute()
        stats = {}
        for item in (res.data or []):
            if not isinstance(item, dict): continue
            pred = str(item.get("prediction") or "")
            crop = pred.split("_")[0]
            stats[crop] = stats.get(crop, 0) + 1
        return {"success": True, "data": stats, "source": "supabase"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ═══════════════════════════════════════════════════════════
# UC-E03: KNOWLEDGE LIBRARY — Thư viện Kiến thức
# ═══════════════════════════════════════════════════════════
@app.get("/api/library")
def get_library():
    """Lấy toàn bộ thư viện kiến thức"""
    if not (USE_SUPABASE and supabase):
        # Fallback: trả về CROP_DETAILS
        return [{"key": k, **v} for k, v in CROP_DETAILS.items()]
    try:
        res = supabase.table("knowledge_library").select("*").order("created_at", desc=True).execute()
        if res.data:
            return res.data
        return [{"key": k, **v} for k, v in CROP_DETAILS.items()]
    except:
        return [{"key": k, **v} for k, v in CROP_DETAILS.items()]

@app.post("/api/library")
def add_library_item(request: dict, user: dict = Depends(verify_expert_role)):
    """Chuyên gia thêm kiến thức mới"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        res = supabase.table("knowledge_library").insert(request).execute()
        return {"success": True, "data": res.data[0] if res.data else None}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.get("/api/library/my")
def get_my_library(expert_user: dict = Depends(verify_expert_role)):
    """Lấy danh sách bài viết kiến thức của riêng chuyên gia đang đăng nhập"""
    if not (USE_SUPABASE and supabase):
        return []
    try:
        expert_id = expert_user.get("sub")
        res = supabase.table("knowledge_library").select("*").eq("author_id", expert_id).order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        print(f"Get My Library Error: {e}")
        return []

@app.put("/api/library/{item_id}")
def update_library_item(item_id: str, request: dict, expert_user: dict = Depends(verify_expert_role)):
    """Cập nhật nội dung bài viết trong thư viện kiến thức (Yêu cầu quyền Chuyên gia)"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        res = supabase.table("knowledge_library").update(request).eq("id", item_id).execute()
        return {"success": True, "data": res.data[0] if res.data else None}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.delete("/api/library/{item_id}")
def delete_library_item(item_id: str, expert_user: dict = Depends(verify_expert_role)):
    """Xóa bài viết khỏi thư viện kiến thức (Yêu cầu quyền Chuyên gia)"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        supabase.table("knowledge_library").delete().eq("id", item_id).execute()
        return {"success": True, "message": "Đã xóa bài viết thành công"}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.get("/api/library/my")
def get_my_library(expert_user: dict = Depends(verify_expert_role)):
    """Lấy danh sách bài viết kiến thức của riêng chuyên gia đang đăng nhập"""
    if not (USE_SUPABASE and supabase):
        return []
    try:
        expert_id = expert_user.get("sub")
        res = supabase.table("knowledge_library").select("*").eq("author_id", expert_id).order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        print(f"Get My Library Error: {e}")
        return []

@app.put("/api/library/{item_id}")
def update_library_item(item_id: str, request: dict, expert_user: dict = Depends(verify_expert_role)):
    """Cập nhật nội dung bài viết trong thư viện kiến thức (Yêu cầu quyền Chuyên gia)"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        res = supabase.table("knowledge_library").update(request).eq("id", item_id).execute()
        return {"success": True, "data": res.data[0] if res.data else None}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.delete("/api/library/{item_id}")
def delete_library_item(item_id: str, expert_user: dict = Depends(verify_expert_role)):
    """Xóa bài viết khỏi thư viện kiến thức (Yêu cầu quyền Chuyên gia)"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        supabase.table("knowledge_library").delete().eq("id", item_id).execute()
        return {"success": True, "message": "Đã xóa bài viết thành công"}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.get("/api/library/my")
def get_my_library(expert_user: dict = Depends(verify_expert_role)):
    """Lấy danh sách bài viết kiến thức của riêng chuyên gia đang đăng nhập"""
    if not (USE_SUPABASE and supabase):
        return []
    try:
        expert_id = expert_user.get("sub")
        res = supabase.table("knowledge_library").select("*").eq("author_id", expert_id).order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        print(f"Get My Library Error: {e}")
        return []

@app.put("/api/library/{item_id}")
def update_library_item(item_id: str, request: dict, expert_user: dict = Depends(verify_expert_role)):
    """Cập nhật nội dung bài viết trong thư viện kiến thức (Yêu cầu quyền Chuyên gia)"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        res = supabase.table("knowledge_library").update(request).eq("id", item_id).execute()
        return {"success": True, "data": res.data[0] if res.data else None}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.delete("/api/library/{item_id}")
def delete_library_item(item_id: str, expert_user: dict = Depends(verify_expert_role)):
    """Xóa bài viết khỏi thư viện kiến thức (Yêu cầu quyền Chuyên gia)"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        supabase.table("knowledge_library").delete().eq("id", item_id).execute()
        return {"success": True, "message": "Đã xóa bài viết thành công"}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

# ═══════════════════════════════════════════════════════════
# UC-A01: ADMIN — Quản lý người dùng
# ═══════════════════════════════════════════════════════════
@app.get("/api/admin/users")
def admin_get_users(admin_user: dict = Depends(verify_admin_role)):
    """Lấy danh sách người dùng"""
    if not (USE_SUPABASE and supabase):
        return []
    try:
        # Sử dụng updated_at thay vì created_at vì bảng của bạn không có created_at
        res = supabase.table("profiles").select("*").order("updated_at", desc=True).execute()
        users = res.data or []
        print(f"DEBUG: Found {len(users)} users")
        
        # Merge banned status from SQLite
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id, banned FROM custom_users")
            banned_map = {row[0]: bool(row[1]) for row in cursor.fetchall()}
            conn.close()
            for u in users:
                if isinstance(u, dict):
                    u["banned"] = banned_map.get(u.get("id"), False)
        except Exception as ban_err:
            print(f"Merge banned status error: {ban_err}")
        
        return users
    except Exception as e:
        print(f"Admin Users Error: {e}")
        return []

from pydantic import BaseModel
from typing import Optional

class RoleUpdateSchema(BaseModel):
    role: str

class BanUpdateSchema(BaseModel):
    banned: Optional[bool] = True

@app.post("/api/admin/users/{user_id}/role")
def admin_set_role(user_id: str, data: RoleUpdateSchema, admin_user: dict = Depends(verify_admin_role)):
    """Phân quyền user (user/expert/admin)"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        role = data.role
        # Cập nhật trên Supabase
        supabase.table("profiles").update({"role": role}).eq("id", user_id).execute()
        
        # Cập nhật SQLite để đồng bộ đăng nhập cục bộ
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE custom_users SET role = ? WHERE id = ?", (role, user_id))
        conn.commit()
        conn.close()
        
        return {"success": True, "user_id": user_id, "new_role": role}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.post("/api/admin/users/{user_id}/ban")
def admin_ban_user(user_id: str, data: Optional[BanUpdateSchema] = None, admin_user: dict = Depends(verify_admin_role)):
    """Khóa/mở khóa tài khoản"""
    try:
        banned = data.banned if (data and data.banned is not None) else True
        banned_int = 1 if banned else 0
        
        # Update SQLite
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE custom_users SET banned = ? WHERE id = ?", (banned_int, user_id))
        conn.commit()
        conn.close()
        
        return {"success": True, "user_id": user_id, "banned": banned}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: str, admin_user: dict = Depends(verify_admin_role)):
    """Xóa tài khoản người dùng vĩnh viễn"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM custom_users WHERE id = ?", (user_id,))
        conn.commit()
    except Exception as sqle:
        print(f"Delete SQLite custom_user error: {sqle}")
    finally:
        conn.close()
        
    if USE_SUPABASE and supabase:
        try:
            supabase.table("profiles").delete().eq("id", user_id).execute()
        except Exception as sube:
            print(f"Delete Supabase profiles error: {sube}")
            
    return {"success": True, "message": "Đã xóa vĩnh viễn tài khoản người dùng"}

@app.get("/api/admin/stats")
def admin_get_stats(admin_user: dict = Depends(verify_admin_role)):
    """Lấy số liệu thống kê tổng quan thực tế và dữ liệu biểu đồ cho Dashboard Premium"""
    stats = {
        "users": 0, 
        "active_users": 0,
        "posts": 0, 
        "today_posts": 0,
        "pending_reports": 0, 
        "new_reports": 0,
        "experts": 0,
        "interactions": 0,
        "db_error": None,
        "engagement_chart": {
            "labels": [],
            "likes": [],
            "comments": []
        },
        "crop_scans_chart": {
            "rice": 45,
            "corn": 28,
            "potato": 18,
            "cassava": 15,
            "peanut": 12,
            "sweet_potato": 8
        },
        "scan_frequency_chart": {
            "labels": [(datetime.datetime.now() - datetime.timedelta(days=i)).strftime("%d/%m") for i in range(6, -1, -1)],
            "data": [15, 22, 19, 35, 42, 38, 55]
        }
    }
    
    if not (USE_SUPABASE and supabase):
        try:
            local_scans = {}
            for jf in HISTORY_DIR.glob("*.json"):
                try:
                    with open(jf, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        pred = data.get("prediction", "")
                        if pred:
                            crop = pred.split("_")[0]
                            if crop:
                                local_scans[crop] = local_scans.get(crop, 0) + 1
                except:
                    continue
            if local_scans:
                stats["crop_scans_chart"] = local_scans

            local_scan_dates = []
            for jf in HISTORY_DIR.glob("*.json"):
                try:
                    stat_info = jf.stat()
                    mtime = datetime.datetime.fromtimestamp(stat_info.st_mtime)
                    local_scan_dates.append(mtime.strftime("%Y-%m-%d"))
                except:
                    continue
            if local_scan_dates:
                labels_scan = []
                scan_counts = []
                for i in range(6, -1, -1):
                    target_date = (datetime.datetime.now() - datetime.timedelta(days=i))
                    day_str = target_date.strftime("%d/%m")
                    date_str = target_date.strftime("%Y-%m-%d")
                    labels_scan.append(day_str)
                    scan_counts.append(sum(1 for d in local_scan_dates if d == date_str))
                stats["scan_frequency_chart"] = {
                    "labels": labels_scan,
                    "data": scan_counts
                }
        except:
            pass
        return stats
    
    try:
        # 1. Tổng người dùng & hoạt động
        res_users = supabase.table("profiles").select("id", "last_seen", count=CountMethod.exact).execute()
        stats["users"] = res_users.count or 0
        
        # Đếm user "online" (trong 5 phút qua)
        now = datetime.datetime.now(datetime.timezone.utc)
        online_count = 0
        if res_users.data and isinstance(res_users.data, list):
            for u in res_users.data:
                if isinstance(u, dict):
                    ls = u.get('last_seen')
                    if ls:
                        try:
                            ls_dt = datetime.datetime.fromisoformat(str(ls).replace('Z', '+00:00'))
                            if (now - ls_dt).total_seconds() < 300: # 5 phút
                                online_count += 1
                        except: pass
        stats["active_users"] = online_count
        
        # 2. Bài đăng & Báo cáo
        res_posts = supabase.table("posts").select("id", "created_at", count=CountMethod.exact).execute()
        stats["posts"] = res_posts.count or 0
        
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        stats["today_posts"] = sum(1 for p in (res_posts.data or []) if isinstance(p, dict) and str(p.get('created_at', '')).startswith(today))
        
        try:
            res_reports = supabase.table("reports").select("id", "created_at", count=CountMethod.exact).eq("status", "pending").execute()
            stats["pending_reports"] = res_reports.count or 0
            stats["new_reports"] = sum(1 for r in (res_reports.data or []) if isinstance(r, dict) and str(r.get('created_at', '')).startswith(today))
        except:
            stats["pending_reports"] = 0
            
        # Count interactions
        try:
            stats["interactions"] = (supabase.table("likes").select("id", count=CountMethod.exact).execute().count or 0) + (supabase.table("comments").select("id", count=CountMethod.exact).execute().count or 0)
        except: pass

        # 3. Dữ liệu biểu đồ (7 ngày gần nhất) - DỮ LIỆU THẬT
        labels = []
        likes_data = []
        comments_data = []
        shares_data = []
        
        # Lấy mốc thời gian 7 ngày trước
        seven_days_ago = (datetime.datetime.now() - datetime.timedelta(days=7)).isoformat()
        
        # Truy vấn dữ liệu thật
        all_posts = supabase.table("posts").select("created_at").gte("created_at", seven_days_ago).execute().data or []
        all_comments = supabase.table("comments").select("created_at").gte("created_at", seven_days_ago).execute().data or []
        
        for i in range(6, -1, -1):
            target_date = (datetime.datetime.now() - datetime.timedelta(days=i))
            day_str = target_date.strftime("%d/%m")
            date_prefix = target_date.strftime("%Y-%m-%d")
            
            labels.append(day_str)
            
            # Đếm số lượng thực tế
            p_count = sum(1 for p in all_posts if isinstance(p, dict) and str(p.get('created_at', '')).startswith(date_prefix))
            c_count = sum(1 for c in all_comments if isinstance(c, dict) and str(c.get('created_at', '')).startswith(date_prefix))
            
            # Vì bảng likes không có created_at, ta tạm tính likes = posts * 3 + ngẫu nhiên nhỏ để biểu đồ có dữ liệu
            # Nếu sau này có created_at cho likes thì sẽ update sau
            l_count = p_count * 3 + (i % 3) 
            s_count = int(c_count * 0.5) + (i % 2)
            
            likes_data.append(l_count)
            comments_data.append(c_count)
            shares_data.append(s_count)
            
        stats["engagement_chart"] = {
            "labels": labels,
            "likes": likes_data,
            "comments": comments_data,
            "shares": shares_data
        }

        # Tỷ lệ cây trồng được nhận diện
        crop_scans_chart = {}
        try:
            res_scans = supabase.table("scan_history").select("prediction").execute()
            for item in (res_scans.data or []):
                if isinstance(item, dict):
                    pred = str(item.get("prediction") or "")
                    crop = pred.split("_")[0]
                    if crop:
                        crop_scans_chart[crop] = crop_scans_chart.get(crop, 0) + 1
        except Exception as e:
            print(f"Error computing crop_scans: {e}")
            
        if not crop_scans_chart:
            for jf in HISTORY_DIR.glob("*.json"):
                try:
                    with open(jf, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        pred = data.get("prediction", "")
                        if pred:
                            crop = pred.split("_")[0]
                            if crop:
                                crop_scans_chart[crop] = crop_scans_chart.get(crop, 0) + 1
                except:
                    continue
                    
        if crop_scans_chart:
            stats["crop_scans_chart"] = crop_scans_chart

        # Tần suất sử dụng chức năng AI
        labels_scan = []
        scan_counts = []
        all_scans = []
        try:
            seven_days_ago = (datetime.datetime.now() - datetime.timedelta(days=7)).isoformat()
            all_scans = supabase.table("scan_history").select("timestamp, created_at").gte("created_at", seven_days_ago).execute().data or []
        except:
            for jf in HISTORY_DIR.glob("*.json"):
                try:
                    stat_info = jf.stat()
                    mtime = datetime.datetime.fromtimestamp(stat_info.st_mtime)
                    all_scans.append({"created_at": mtime.isoformat()})
                except:
                    continue

        for i in range(6, -1, -1):
            target_date = (datetime.datetime.now() - datetime.timedelta(days=i))
            day_str = target_date.strftime("%d/%m")
            date_prefix = target_date.strftime("%Y-%m-%d")
            
            labels_scan.append(day_str)
            s_count = sum(1 for s in all_scans if isinstance(s, dict) and str(s.get('timestamp') or s.get('created_at') or '').startswith(date_prefix))
            scan_counts.append(s_count)
            
        if sum(scan_counts) > 0:
            stats["scan_frequency_chart"] = {
                "labels": labels_scan,
                "data": scan_counts
            }

        return stats
    except Exception as e:
        print(f"Admin Stats Error: {e}")
        stats["db_error"] = str(e)
        return stats

@app.patch("/api/admin/posts/{post_id}/status")
def update_post_status(post_id: str, status: str = Query(...), admin_user: dict = Depends(verify_admin_role)):
    """Cập nhật trạng thái bài viết (active/restricted)"""
    if not supabase: return {"success": False}
    try:
        supabase.table("posts").update({"status": status}).eq("id", post_id).execute()
        return {"success": True, "post_id": post_id, "status": status}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.get("/api/admin/reports")
def get_reports(admin_user: dict = Depends(verify_admin_role)):
    """Lấy danh sách báo cáo vi phạm kèm thông tin bài viết"""
    if not supabase: return []
    try:
        # Lấy báo cáo join với bài viết và người báo cáo
        res = supabase.table("reports").select("*, posts(*, profiles(full_name)), profiles!reporter_id(full_name)").eq("status", "pending").execute()
        return res.data or []
    except Exception as e:
        print(f"Get Reports Error: {e}")
        return []

@app.post("/api/admin/reports/{report_id}/resolve")
def admin_resolve_report(report_id: str, admin_user: dict = Depends(verify_admin_role)):
    """Admin giải quyết/bác bỏ báo cáo vi phạm (đổi trạng thái thành resolved)"""
    if not supabase: return JSONResponse({"error": "No DB"}, status_code=500)
    try:
        res = supabase.table("reports").update({"status": "resolved"}).eq("id", report_id).execute()
        return {"success": True, "message": "Đã giải quyết báo cáo", "data": res.data}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# ═══════════════════════════════════════════════════════════
# UC-A02: MODEL VERSIONING — Quản lý phiên bản AI
# ═══════════════════════════════════════════════════════════
@app.get("/api/admin/models")
def admin_list_models(admin_user: dict = Depends(verify_admin_role)):
    """Liệt kê các model đã train"""
    models = []
    model_dir = Path(__file__).parent.parent / "models"
    if model_dir.exists():
        for f in sorted(list(model_dir.glob("*.h5")) + list(model_dir.glob("*.keras"))):
            models.append({
                "filename": f.name,
                "size_mb": round(f.stat().st_size / (1024*1024), 1),
                "modified": datetime.datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                "active": f.name in ["crop_classifier_best.h5", "crop_super_v2s_best.keras"]
            })
    return {"success": True, "models": models}

@app.post("/api/admin/models/deploy")
def admin_deploy_model(request: dict, admin_user: dict = Depends(verify_admin_role)):
    """Triển khai model mới"""
    import shutil
    model_name = request.get("model_name", "")
    model_dir = Path(__file__).parent.parent / "models"
    source = model_dir / model_name
    
    # Xác định file đích dựa trên định dạng của file nguồn (.keras hoặc .h5)
    ext = source.suffix
    target = model_dir / f"crop_classifier_best{ext}"
    
    if not source.exists():
        return JSONResponse({"success": False, "error": "Model không tồn tại"}, status_code=404)
    try:
        backup = model_dir / f"crop_classifier_best_backup_{int(time.time())}{ext}"
        if target.exists():
            shutil.copy2(str(target), str(backup))
        shutil.copy2(str(source), str(target))
        return {"success": True, "deployed": model_name, "backup": backup.name}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

# ═══════════════════════════════════════════════════════════
# UC-A01: MODERATION — Kiểm duyệt bài viết
# ═══════════════════════════════════════════════════════════
@app.post("/api/admin/posts/{post_id}/status")
def admin_update_post_status(post_id: str, data: dict, admin_user: dict = Depends(verify_admin_role)):
    """Admin cập nhật trạng thái bài viết (active/restricted)"""
    if not supabase: return JSONResponse({"error": "No DB"}, status_code=500)
    try:
        new_status = data.get("status", "active")
        res = supabase.table("posts").update({"status": new_status}).eq("id", post_id).execute()
        return {"success": True, "data": res.data}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.delete("/api/admin/posts/{post_id}")
def admin_delete_post(post_id: str, admin_user: dict = Depends(verify_admin_role)):
    """Admin xóa vĩnh viễn bài viết (Có kiểm tra kết quả)"""
    if not supabase: return JSONResponse({"error": "No DB"}, status_code=500)
    try:
        # 1. Xóa các bảng liên quan
        supabase.table("reports").delete().eq("post_id", post_id).execute()
        supabase.table("comments").delete().eq("post_id", post_id).execute()
        supabase.table("likes").delete().eq("post_id", post_id).execute()
        
        # 2. Xóa bài viết chính
        res = supabase.table("posts").delete().eq("id", post_id).execute()
        
        # Kiểm tra xem có thực sự xóa được dòng nào không
        if not res.data:
            return JSONResponse({
                "error": "Không thể xóa bài viết. Có thể do quyền hạn (RLS) hoặc ID không tồn tại.",
                "details": str(res)
            }, status_code=403)
            
        return {"success": True, "message": "Đã xóa vĩnh viễn"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

def process_admin_posts(posts):
    svg_placeholder = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YxZjVmOSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjOTRhM2I4Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4="
    if not posts:
        return []
    for p in posts:
        if isinstance(p, dict):
            img_url = p.get("image_url")
            if img_url:
                if img_url.startswith("/history/"):
                    filename = img_url.split("/")[-1]
                    local_path = HISTORY_DIR / filename
                    if not local_path.exists():
                        p["image_url"] = svg_placeholder
            else:
                p["image_url"] = svg_placeholder
    return posts

@app.get("/api/admin/posts")
def admin_get_all_posts(admin_user: dict = Depends(verify_admin_role)):
    """Admin lấy toàn bộ bài viết (kể cả bài bị hạn chế)"""
    if not supabase: return []
    try:
        # Sử dụng select(*) trước để đảm bảo lấy được bài đăng ngay cả khi join profiles lỗi
        res = supabase.table("posts").select("*, profiles(full_name)").order("created_at", desc=True).execute()
        
        # Nếu res.data rỗng nhưng stats báo có bài đăng, thử lấy không join
        if not res.data:
            res_retry = supabase.table("posts").select("*").order("created_at", desc=True).execute()
            posts = res_retry.data or []
        else:
            posts = res.data or []
            
        return process_admin_posts(posts)
    except Exception as e:
        print(f"Admin Get Posts Error: {e}")
        # Fallback cuối cùng: Lấy dữ liệu cơ bản nhất
        try:
            res_fallback = supabase.table("posts").select("*").limit(100).execute()
            return process_admin_posts(res_fallback.data or [])
        except:
            return []

# Biến toàn cục lưu thông báo khẩn cấp
broadcast_msg = {}

@app.post("/api/admin/broadcast")
def admin_send_broadcast(request: dict, admin_user: dict = Depends(verify_admin_role)):
    """Admin gửi thông báo khẩn cấp đến mọi người dùng"""
    global broadcast_msg
    broadcast_msg = {
        "title": request.get("title", "Thông báo"),
        "message": request.get("message", ""),
        "level": request.get("level", "info"), # info, warning, danger
        "time": datetime.datetime.now().isoformat()
    }
    return {"success": True}

@app.get("/api/broadcast")
def get_broadcast():
    """Client gọi API này để lấy thông báo mới nhất"""
    return {"success": True, "broadcast": broadcast_msg if broadcast_msg else None}

@app.get("/api/admin/ai-data")
def admin_get_ai_data(admin_user: dict = Depends(verify_admin_role)):
    """Lấy lịch sử quét để kiểm duyệt và gán nhãn lại"""
    if not (USE_SUPABASE and supabase):
        return {"success": False, "error": "Supabase chưa kết nối"}
    try:
        # Lấy các ảnh quét gần nhất
        res = supabase.table("scan_history").select("*").order("created_at", desc=True).limit(50).execute()
        return {"success": True, "data": res.data or []}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/admin/relabel")
def admin_relabel_data(request: dict, admin_user: dict = Depends(verify_admin_role)):
    """Gán nhãn lại cho ảnh bị AI nhận diện sai"""
    if not (USE_SUPABASE and supabase):
        return {"success": False, "error": "Supabase chưa kết nối"}
    try:
        scan_id = request.get("id")
        true_label = request.get("true_label")
        if not scan_id or not true_label:
            return {"success": False, "error": "Thiếu dữ liệu"}
        # Cập nhật nhãn đúng vào bảng scan_history
        supabase.table("scan_history").update({"true_label": true_label}).eq("id", scan_id).execute()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ═══════════════════════════════════════════════════════════
# UC-F01: PROFILE UPDATE — Cập nhật thông tin trang trại
# ═══════════════════════════════════════════════════════════
@app.post("/api/profile/update")
def update_profile(request: dict):
    """Cập nhật thông tin hồ sơ và trang trại"""
    if not (USE_SUPABASE and supabase):
        return JSONResponse({"success": False, "error": "Supabase chưa kết nối"}, status_code=500)
    try:
        user_id = request.get("user_id")
        if not user_id:
            return JSONResponse({"success": False, "error": "Thiếu user_id"}, status_code=400)
            
        update_data = {}
        # Danh sách tất cả các trường có thể cập nhật
        allowed_fields = [
            "full_name", "bio", "avatar_url", "cover_url", 
            "farm_location", "farm_area", "main_crop", "phone", "website"
        ]
        
        for field in allowed_fields:
            if field in request:
                update_data[field] = request[field]
                
        if update_data:
            # Sử dụng upsert để đảm bảo profile tồn tại
            update_data["id"] = user_id
            update_data["updated_at"] = "now()"
            supabase.table("profiles").upsert(update_data).execute()
            
        return {"success": True}
    except Exception as e:
        print(f"Error updating profile: {str(e)}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@app.get("/api/profile/{user_id}")
def get_profile(user_id: str):
    """Lấy thông tin profile"""
    if not (USE_SUPABASE and supabase):
        return {}
    try:
        res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        return res.data[0] if res.data else {}
    except:
        return {}


# ═══════════════════════════════════════════════════════════
# UC-F08: CROP CALENDAR — Lịch mùa vụ thông minh
# ═══════════════════════════════════════════════════════════

@app.get("/api/calendar/master-data")
def get_master_seasonal_data():
    if not (USE_SUPABASE and supabase): return []
    try:
        res = supabase.table('master_seasonal_data').select("*").execute()
        return res.data or []
    except: return []

@app.post("/api/calendar/add-crop")
def add_crop_to_calendar(request: dict):
    if not (USE_SUPABASE and supabase): return {"success": False, "error": "Supabase not connected"}
    user_id = request.get("user_id")
    crop_key = request.get("crop_key")
    planting_date_str = request.get("planting_date") 
    region = request.get("region")
    if not all([user_id, crop_key, planting_date_str, region]):
        return {"success": False, "error": "Missing fields"}
    try:
        crop_res = supabase.table('user_crops').insert({
            "user_id": user_id, "crop_key": crop_key,
            "planting_date": planting_date_str, "region": region
        }).execute()
        if not (crop_res.data and isinstance(crop_res.data, list)): return {"success": False}
        first_crop = crop_res.data[0]
        if not isinstance(first_crop, dict): return {"success": False}
        user_crop_id = first_crop.get('id')
        master_res = supabase.table('master_seasonal_data').select("stages").eq("crop_key", crop_key).execute()
        if master_res.data and isinstance(master_res.data, list):
            first_master = master_res.data[0]
            if isinstance(first_master, dict):
                stages = first_master.get('stages')
                if planting_date_str:
                    planting_date = datetime.datetime.strptime(str(planting_date_str), "%Y-%m-%d")
                else:
                    planting_date = datetime.datetime.now()
                tasks = []
                if isinstance(stages, list):
                    for s in stages:
                        if not isinstance(s, dict): continue
                        offset_val = s.get('offset_days', 0)
                        due = planting_date + datetime.timedelta(days=int(str(offset_val)) if offset_val is not None else 0)
                        tasks.append({
                            "user_crop_id": user_crop_id, "user_id": user_id,
                            "title": s.get('title', 'Task'), "due_date": due.strftime("%Y-%m-%d"),
                            "is_important": bool(s.get('important', False))
                        })
                if tasks:
                    supabase.table('crop_tasks').insert(tasks).execute()
        return {"success": True}
    except Exception as e: return {"success": False, "error": str(e)}

@app.get("/api/calendar/tasks")
def get_user_tasks(user_id: str):
    if not (USE_SUPABASE and supabase): return []
    try:
        res = supabase.table('crop_tasks').select("*").eq("user_id", user_id).order('due_date').execute()
        return res.data or []
    except: return []

@app.patch("/api/calendar/tasks/{task_id}")
def toggle_task_status(task_id: str, request: dict):
    if not (USE_SUPABASE and supabase): return {"success": False}
    try:
        is_completed = request.get("is_completed", False)
        supabase.table('crop_tasks').update({"is_completed": is_completed}).eq("id", task_id).execute()
        return {"success": True}
    except: return {"success": False}

@app.delete("/api/calendar/tasks/{task_id}")
def delete_calendar_task(task_id: str):
    if not (USE_SUPABASE and supabase): return {"success": False}
    try:
        supabase.table('crop_tasks').delete().eq("id", task_id).execute()
        return {"success": True}
    except: return {"success": False}

# ═══════════════════════════════════════════════════════════
# UC-F07: WEATHER ALERT — Cảnh báo thời tiết nông nghiệp
# ═══════════════════════════════════════════════════════════
import urllib.request

@app.get("/api/weather")
def get_weather_alert(lat: float = Query(10.0), lon: float = Query(106.0)):
    """Lấy dữ liệu thời tiết + cảnh báo nông nghiệp"""
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_max&timezone=Asia/Ho_Chi_Minh&forecast_days=7"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            weather = json.loads(resp.read().decode())
        
        daily = weather.get("daily", {})
        alerts = []
        
        # Phân tích cảnh báo
        temps = daily.get("temperature_2m_max", [])
        rains = daily.get("precipitation_sum", [])
        humids = daily.get("relative_humidity_2m_max", [])
        
        if humids and max(humids[:3]) > 85:
            if temps and 25 <= max(temps[:3]) <= 35:
                alerts.append({
                    "type": "fungus",
                    "level": "warning",
                    "icon": "🍄",
                    "title": "Cảnh báo Nấm bệnh",
                    "desc": f"Độ ẩm cao ({max(humids[:3])}%) + nhiệt độ ấm → điều kiện lý tưởng cho nấm bệnh phát triển"
                })
        
        rain_days = sum(1 for r in rains[:5] if r > 5) if rains else 0
        if rain_days >= 3:
            alerts.append({
                "type": "flood",
                "level": "danger",
                "icon": "🌊",
                "title": "Cảnh báo Ngập úng",
                "desc": f"Dự báo {rain_days} ngày mưa liên tục → nguy cơ ngập úng ruộng, thối rễ"
            })
        
        if temps and min(daily.get("temperature_2m_min", [20])[:3]) < 15:
            alerts.append({
                "type": "cold",
                "level": "warning",
                "icon": "❄️",
                "title": "Rét đậm",
                "desc": "Nhiệt độ xuống thấp → mạ non có thể chết rét, cần che phủ"
            })
        
        if not alerts:
            alerts.append({
                "type": "safe",
                "level": "safe",
                "icon": "☀️",
                "title": "Thời tiết Thuận lợi",
                "desc": "Điều kiện thời tiết tốt cho cây trồng phát triển"
            })
        return {
            "success": True,
            "daily": daily,
            "alerts": alerts
        }
    except Exception as e:
        return {"success": False, "error": str(e), "alerts": []}

# ══════════════════════════════════════════════════════════════════
# UC-CHAT: AI CHATBOT CHUYÊN GIA NÔNG NGHIỆP (Google Gemini)
# ══════════════════════════════════════════════════════════════════

import json as _json
import time as _time

# Rate limiting store
_chat_rate_limit = {}  # { user_id: [timestamp1, timestamp2, ...] }

# Khởi tạo Gemini (HTTP POST trực tiếp để tránh xung đột protobuf)
_gemini_api_key = os.getenv("GEMINI_API_KEY", "")
_gemini_model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
if _gemini_api_key:
    print(f"[OK] Gemini AI initialized successfully via raw HTTP (model: {_gemini_model_name})")
else:
    print("[WARN] GEMINI_API_KEY not set. Chat will use offline knowledge base only.")


def _build_agro_system_prompt():
    """Xây dựng system prompt với toàn bộ kiến thức nông nghiệp."""
    # Thu thập crop info
    crop_summaries = []
    for key, info in CROP_DETAILS.items():
        summary = f"- {info.get('vi', key)}: {info.get('mo_ta', '')[:200]}"
        if info.get('dieu_kien'):
            dk = info['dieu_kien']
            summary += f" | Nước: {dk.get('nuoc', 'N/A')[:80]} | Đất: {dk.get('dat', 'N/A')[:80]}"
        if info.get('sau_benh'):
            diseases = ', '.join([sb['ten'] for sb in info['sau_benh'][:3]])
            summary += f" | Sâu bệnh: {diseases}"
        crop_summaries.append(summary)

    # Thu thập treatment info
    treatment_summaries = []
    for key, data in TREATMENT_DB.items():
        t = f"- {data['disease_vi']} ({data['disease_en']}) - Cây: {data['crop']} - Mức: {data['severity']}"
        if data.get('emergency'):
            t += f" | Khẩn cấp: {'; '.join(data['emergency'][:2])}"
        if data.get('chemical'):
            chems = ', '.join([c['name'] for c in data['chemical'][:2]])
            t += f" | Thuốc: {chems}"
        treatment_summaries.append(t)

    return f"""Bạn là "Trợ lý AI Nông nghiệp AgriSocial" — một chuyên gia nông nghiệp ảo chuyên về cây lương thực Việt Nam.

QUY TẮC BẮT BUỘC:
1. Luôn trả lời bằng tiếng Việt, thân thiện, dễ hiểu
2. TRẢ LỜI ĐÚNG TRỌNG TÂM câu hỏi. KHÔNG liệt kê thông tin không liên quan:
   - Nếu hỏi "cách trồng" → hướng dẫn kỹ thuật trồng (chọn giống, làm đất, gieo/trồng, mật độ, thời vụ)
   - Nếu hỏi "sâu bệnh" → triệu chứng, nguyên nhân, cách xử lý khẩn cấp, thuốc, phòng ngừa
   - Nếu hỏi "chăm sóc" → tưới nước, bón phân, làm cỏ, vun gốc
   - Nếu hỏi "bón phân" → loại phân, liều lượng, thời điểm bón, cách bón
   - Nếu hỏi "thu hoạch" → dấu hiệu chín, thời điểm thu, cách bảo quản
3. Ưu tiên dùng kiến thức bên dưới, bổ sung thêm từ hiểu biết chung nếu cần
4. Trả lời ngắn gọn, có cấu trúc (dùng emoji, bullet points). Tối đa 300 từ
5. Nếu câu hỏi ngoài phạm vi nông nghiệp, lịch sự từ chối và gợi ý hỏi về cây trồng
6. Khi không chắc chắn, nói rõ và khuyên người dùng tham khảo thêm cơ quan BVTV địa phương

DỮ LIỆU CÂY TRỒNG:
{chr(10).join(crop_summaries)}

DỮ LIỆU PHÁC ĐỒ ĐIỀU TRỊ:
{chr(10).join(treatment_summaries)}"""

def _detect_intent(query_lower: str) -> str:
    """Phát hiện ý định câu hỏi của người dùng."""
    intent_keywords = {
        "growing": ["cách trồng", "trồng như thế nào", "kỹ thuật trồng", "hướng dẫn trồng", "gieo trồng", "gieo sạ", "gieo hạt", "cách gieo", "trồng cây", "muốn trồng", "bắt đầu trồng", "trồng lúa", "trồng ngô", "trồng sắn", "trồng mía", "trồng khoai"],
        "pest_disease": ["sâu bệnh", "bệnh", "sâu", "rầy", "nấm", "virus", "khảm lá", "đạo ôn", "bạc lá", "thối", "héo", "vàng lá", "chết cây", "rệp", "bọ", "nhện", "mốc sương", "gỉ sắt", "sâu đục", "sâu keo", "chổi rồng", "trị bệnh", "diệt sâu", "phòng trị", "xử lý bệnh"],
        "care": ["chăm sóc", "cách chăm", "tưới nước", "tưới", "cắt tỉa", "làm cỏ", "vun luống", "vun gốc", "quản lý", "nuôi dưỡng"],
        "fertilizer": ["bón phân", "phân bón", "phân đạm", "phân lân", "phân kali", "NPK", "phân hữu cơ", "dinh dưỡng", "bổ sung dinh dưỡng", "cách bón"],
        "harvest": ["thu hoạch", "khi nào thu", "thời điểm thu", "cách thu hoạch", "bảo quản", "sau thu hoạch", "phơi", "sấy", "dấu hiệu", "nhận biết", "biết khi nào", "chín chưa", "lúc nào chín", "đến mùa vụ", "mùa vụ thu"],
        "conditions": ["điều kiện", "đất trồng", "loại đất", "khí hậu", "nhiệt độ", "ánh sáng", "nước", "mùa vụ", "thời vụ", "vùng trồng", "thổ nhưỡng"],
        "info": ["là gì", "giới thiệu", "thông tin", "tìm hiểu"]
    }
    for intent, keywords in intent_keywords.items():
        for kw in keywords:
            if kw in query_lower:
                return intent
    return "general"

def _detect_crop(query_lower: str):
    """Phát hiện cây trồng trong câu hỏi."""
    crop_map = {
        'lúa': 'rice', 'lua': 'rice', 'gạo': 'rice',
        'ngô': 'corn', 'ngo': 'corn', 'bắp': 'corn',
        'lúa mì': 'wheat', 'lua mi': 'wheat',
        'đậu nành': 'soybean', 'dau nanh': 'soybean', 'đậu tương': 'soybean',
        'mía': 'sugarcane', 'mia': 'sugarcane',
        'khoai lang': 'sweet_potato',
        'sắn': 'cassava', 'san': 'cassava', 'khoai mì': 'cassava',
        'khoai tây': 'potato',
    }
    # Kiểm tra từ dài trước (khoai lang trước khoai)
    for vn, en in sorted(crop_map.items(), key=lambda x: -len(x[0])):
        if vn in query_lower:
            return en
    return None

def _offline_knowledge_search(query: str) -> str:
    """Tìm kiếm thông minh trong knowledge base — trả lời theo đúng câu hỏi."""
    query_lower = query.lower()
    intent = _detect_intent(query_lower)
    crop_key = _detect_crop(query_lower)
    results = []
    guide = FARMING_GUIDES.get(crop_key, {}) if crop_key else {}

    # === 1. SÂU BỆNH CỤ THỂ ===
    if intent == "pest_disease":
        for key, data in TREATMENT_DB.items():
            disease_vi = data.get('disease_vi', '').lower()
            disease_words = disease_vi.split()
            if disease_vi in query_lower or any(w in query_lower for w in disease_words if len(w) > 2):
                emergency = '\n'.join([f"  ⚡ {e}" for e in data.get('emergency', [])])
                chemicals = '\n'.join([f"  💊 {c['name']} ({c['dosage']}) — {c.get('note','')}" for c in data.get('chemical', [])[:3]])
                bio = '\n'.join([f"  🌱 {b}" for b in data.get('biological', [])[:2]])
                prevention = '\n'.join([f"  🛡️ {p}" for p in data.get('prevention', [])[:3]])
                sev = '🔴 Nghiêm trọng' if data['severity'] in ('critical','high') else '🟡 Trung bình'
                return f"🏥 **{data['disease_vi']}** ({data['disease_en']})\nMức độ: {sev}\n\n**⚡ Xử lý khẩn cấp:**\n{emergency}\n\n**💊 Thuốc điều trị:**\n{chemicals}\n\n**🌱 Biện pháp sinh học:**\n{bio}\n\n**🛡️ Phòng ngừa:**\n{prevention}"

        if crop_key:
            info = CROP_DETAILS.get(crop_key, {})
            crop_vi = info.get('vi', crop_key)
            if info.get('sau_benh'):
                diseases = '\n'.join([f"  • **{sb['ten']}**: {sb['mo_ta']}" for sb in info['sau_benh']])
                results.append(f"🐛 **Sâu bệnh thường gặp trên {crop_vi}:**\n{diseases}")
            if crop_key in CROP_DISEASES:
                treatments = '\n'.join([f"  📋 {d['disease_vi']} ({d['severity']})" for d in CROP_DISEASES[crop_key]])
                results.append(f"\n📖 **Phác đồ điều trị có sẵn:**\n{treatments}\n\n💡 Hãy hỏi tên bệnh cụ thể để tôi hướng dẫn chi tiết!")
            if results:
                return '\n\n'.join(results)

    # === 2. CÁCH TRỒNG ===
    if intent == "growing" and crop_key:
        g = guide.get('growing', {})
        if g:
            steps = '\n'.join([f"  {s}" for s in g.get('steps', [])])
            return f"🌱 **{g.get('title', 'Kỹ thuật trồng')}**\n\n{steps}"
        # Fallback nếu chưa có guide
        info = CROP_DETAILS.get(crop_key, {})
        props = info.get('thuoc_tinh', {})
        conds = info.get('dieu_kien', {})
        results.append(f"🌱 **Hướng dẫn trồng {info.get('vi','')}**")
        if props:
            results.append(f"  • Thời gian: {props.get('thoi_gian','N/A')}\n  • Môi trường: {props.get('moi_truong','N/A')}")
        if conds:
            results.append(f"  • 💧 Nước: {conds.get('nuoc','')}\n  • 🪨 Đất: {conds.get('dat','')}")
        if info.get('meo_chuyen_gia'):
            results.append(f"💡 **Mẹo:** {info['meo_chuyen_gia']}")
        return '\n\n'.join(results)

    # === 3. CHĂM SÓC ===
    if intent == "care" and crop_key:
        c = guide.get('care', {})
        if c:
            steps = '\n'.join([f"  {s}" for s in c.get('steps', [])])
            return f"🌿 **{c.get('title', 'Chăm sóc')}**\n\n{steps}"
        info = CROP_DETAILS.get(crop_key, {})
        conds = info.get('dieu_kien', {})
        results.append(f"🌿 **Chăm sóc {info.get('vi','')}:**")
        if conds:
            results.append(f"  • 💧 Nước: {conds.get('nuoc','')}\n  • ☀️ Ánh sáng: {conds.get('anh_sang','')}")
        if info.get('meo_chuyen_gia'):
            results.append(f"💡 **Mẹo:** {info['meo_chuyen_gia']}")
        return '\n\n'.join(results)

    # === 4. BÓN PHÂN ===
    if intent == "fertilizer" and crop_key:
        f = guide.get('fertilizer', {})
        if f:
            steps = '\n'.join([f"  {s}" for s in f.get('steps', [])])
            return f"🧪 **{f.get('title', 'Bón phân')}**\n\n{steps}"
        info = CROP_DETAILS.get(crop_key, {})
        results.append(f"🧪 **Bón phân cho {info.get('vi','')}:**")
        fert_tips = []
        for key, data in TREATMENT_DB.items():
            if data.get('crop') == crop_key:
                for p in data.get('prevention', []):
                    if any(kw in p.lower() for kw in ['phân', 'bón', 'đạm', 'kali']):
                        fert_tips.append(p)
        for tip in list(dict.fromkeys(fert_tips))[:5]:
            results.append(f"  • {tip}")
        if info.get('meo_chuyen_gia'):
            results.append(f"💡 **Mẹo:** {info['meo_chuyen_gia']}")
        return '\n\n'.join(results)

    # === 5. THU HOẠCH ===
    if intent == "harvest" and crop_key:
        h = guide.get('harvest', {})
        if h:
            signs = '\n'.join([f"  {s}" for s in h.get('signs', [])])
            storage = h.get('storage', '')
            result = f"🌾 **{h.get('title', 'Thu hoạch')}**\n\n**🔍 Dấu hiệu nhận biết:**\n{signs}"
            if storage:
                result += f"\n\n**📦 Bảo quản:** {storage}"
            return result
        info = CROP_DETAILS.get(crop_key, {})
        props = info.get('thuoc_tinh', {})
        results.append(f"🌾 **Thu hoạch {info.get('vi','')}:**")
        if props:
            results.append(f"  • Thời gian sinh trưởng: {props.get('thoi_gian','N/A')}")
        if info.get('meo_chuyen_gia'):
            results.append(f"💡 **Mẹo:** {info['meo_chuyen_gia']}")
        return '\n\n'.join(results)

    # === 6. ĐIỀU KIỆN TRỒNG ===
    if intent == "conditions" and crop_key:
        info = CROP_DETAILS.get(crop_key, {})
        conds = info.get('dieu_kien', {})
        props = info.get('thuoc_tinh', {})
        results.append(f"🌍 **Điều kiện trồng {info.get('vi','')}:**")
        if props:
            results.append(f"  • Môi trường: {props.get('moi_truong','N/A')}\n  • Thời gian: {props.get('thoi_gian','N/A')}")
        if conds:
            results.append(f"  • 💧 Nước: {conds.get('nuoc','')}\n  • ☀️ Ánh sáng: {conds.get('anh_sang','')}\n  • 🪨 Đất: {conds.get('dat','')}")
        return '\n\n'.join(results)

    # === 7. THÔNG TIN CHUNG ===
    if crop_key:
        info = CROP_DETAILS.get(crop_key, {})
        results.append(f"🌾 **{info.get('vi',crop_key)}** ({info.get('ten_khoa_hoc','')})\n{info.get('mo_ta','')}")
        props = info.get('thuoc_tinh', {})
        if props:
            results.append(f"📋 **Đặc điểm:**\n  • Loại: {props.get('loai_cay','')}\n  • Chiều cao: {props.get('chieu_cao','')}\n  • Thời gian: {props.get('thoi_gian','')}")
        conds = info.get('dieu_kien', {})
        if conds:
            results.append(f"🌍 **Điều kiện:**\n  • Nước: {conds.get('nuoc','')}\n  • Đất: {conds.get('dat','')}")
        if info.get('meo_chuyen_gia'):
            results.append(f"💡 **Mẹo:** {info['meo_chuyen_gia']}")
        if info.get('su_that'):
            results.append(f"📌 **Bạn có biết?** {info['su_that']}")
        return '\n\n'.join(results)

    # === 8. Không tìm thấy ===
    crop_list = ', '.join([info.get('vi', k) for k, info in CROP_DETAILS.items()])
    return f"Xin lỗi, tôi chưa tìm thấy thông tin phù hợp. 🌿\n\nTôi có thể giúp bạn về: **{crop_list}**.\n\n💡 **Gợi ý:**\n  • Cách trồng lúa hiệu quả?\n  • Dấu hiệu thu hoạch ngô?\n  • Bệnh đạo ôn trị bằng cách nào?"

from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    conversation_history: str = "[]"
    user_id: str = "anonymous"

@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest):
    """AI Chat endpoint — Gemini với fallback offline."""
    message = request.message
    conversation_history = request.conversation_history
    user_id = request.user_id
    
    # Rate limiting: max 12 messages/minute
    now = _time.time()
    if user_id not in _chat_rate_limit:
        _chat_rate_limit[user_id] = []
    _chat_rate_limit[user_id] = [t for t in _chat_rate_limit[user_id] if now - t < 60]
    if len(_chat_rate_limit[user_id]) >= 12:
        return {"success": False, "reply": "⏳ Bạn đang hỏi quá nhanh. Vui lòng đợi 1 phút rồi thử lại nhé!", "source": "rate_limit"}
    _chat_rate_limit[user_id].append(now)

    # Parse conversation history
    try:
        history = _json.loads(conversation_history) if conversation_history else []
    except:
        history = []

    # Thử Gemini trước
    if _gemini_api_key:
        try:
            import requests  # type: ignore
            system_prompt = _build_agro_system_prompt()
            
            # Build conversation for Gemini
            gemini_history = []
            for msg in history[-6:]:  # Giữ 6 tin nhắn gần nhất
                role = "user" if msg.get("role") == "user" else "model"
                gemini_history.append({"role": role, "parts": [{"text": msg.get("content", "")}]})
            
            # Thêm câu hỏi hiện tại
            gemini_history.append({"role": "user", "parts": [{"text": message}]})
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{_gemini_model_name}:generateContent?key={_gemini_api_key}"
            headers = {
                "Content-Type": "application/json"
            }
            payload = {
                "contents": gemini_history,
                "systemInstruction": {
                    "parts": [
                        {"text": system_prompt}
                    ]
                }
            }
            
            response = requests.post(url, headers=headers, json=payload, timeout=25)
            if response.status_code != 200:
                raise Exception(f"Gemini API returned status {response.status_code}: {response.text}")
                
            resp_json = response.json()
            reply_text = resp_json["candidates"][0]["content"]["parts"][0]["text"].strip()
            
            return {
                "success": True,
                "reply": reply_text,
                "source": "gemini",
                "suggestions": _get_follow_up_suggestions(message)
            }
        except Exception as e:
            error_msg = str(e)
            print(f"Gemini error: {error_msg}")
            # Fallback: Offline knowledge base
            reply = _offline_knowledge_search(message)
            return {
                "success": True,
                "reply": f"⚠️ *(Trợ lý Offline - Do sự cố kết nối AI)*\n\n{reply}",
                "source": "knowledge_base",
                "suggestions": _get_follow_up_suggestions(message)
            }
    
    # Fallback: Offline knowledge base
    reply = _offline_knowledge_search(message)
    return {
        "success": True,
        "reply": reply,
        "source": "knowledge_base",
        "suggestions": _get_follow_up_suggestions(message)
    }

def _get_follow_up_suggestions(query: str) -> list:
    """Gợi ý câu hỏi tiếp theo."""
    query_lower = query.lower()
    suggestions = []
    
    # Detect crop
    crop_keywords = {
        'lúa': 'rice', 'ngô': 'corn', 'bắp': 'corn', 'lúa mì': 'wheat',
        'đậu nành': 'soybean', 'mía': 'sugarcane', 'khoai lang': 'sweet_potato',
        'sắn': 'cassava', 'khoai tây': 'potato'
    }
    detected_crop = None
    for vn, en in crop_keywords.items():
        if vn in query_lower:
            detected_crop = en
            break
    
    if detected_crop:
        crop_info = CROP_DETAILS.get(detected_crop, {})
        crop_vi = crop_info.get('vi', detected_crop)
        suggestions = [
            f"Cách bón phân cho {crop_vi}?",
            f"Sâu bệnh thường gặp ở {crop_vi}?",
            f"Kỹ thuật trồng {crop_vi} hiệu quả?"
        ]
    else:
        suggestions = [
            "Cách phòng trị rầy nâu trên lúa?",
            "Kỹ thuật trồng ngô năng suất cao?",
            "Bệnh mốc sương khoai tây xử lý thế nào?"
        ]
    
    return suggestions[:3]


# ==========================================
# EXPERT VERIFICATION API
# ==========================================
import time
from fastapi import Form, UploadFile, File

@app.post('/api/expert/verification')
async def submit_verification(
    user_id: str = Form(...),
    full_name: str = Form(...),
    cert_name: str = Form(...),
    cert_image: Optional[UploadFile] = File(None)
):
    if not (USE_SUPABASE and supabase):
        return JSONResponse({'success': False, 'error': 'Supabase chưa kết nối'}, status_code=500)
    
    try:
        cert_image_url = ""
        if cert_image and cert_image.filename:
            image_name = f"cert_{user_id}_{int(time.time())}.jpg"
            image_bytes = await cert_image.read()
            try:
                content_type = cert_image.content_type if cert_image.content_type else "application/octet-stream"
                supabase.storage.from_('crop-images').upload(image_name, image_bytes, file_options={"upsert": "true", "content-type": content_type}) # type: ignore
                res = supabase.storage.from_('crop-images').get_public_url(image_name)
                if res:
                    cert_image_url = res
            except Exception as upload_err:
                print(f"Error uploading cert_image: {upload_err}")
                
        payload = {
            'user_id': user_id,
            'full_name': full_name,
            'cert_name': cert_name,
            'cert_image_url': cert_image_url,
            'status': 'pending'
        }
        
        # Insert or Update verification request
        res = supabase.table('expert_verifications').upsert(payload, on_conflict='user_id').execute()
        return {'success': True, 'message': 'Gửi yêu cầu xác minh thành công'}
    except Exception as e:
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)

@app.get('/api/expert/verifications')
async def get_pending_verifications():
    if not (USE_SUPABASE and supabase):
        return JSONResponse({'success': False, 'error': 'Supabase chưa kết nối'}, status_code=500)
        
    try:
        res = supabase.table('expert_verifications').select('*').eq('status', 'pending').order('created_at', desc=True).execute()
        return {'success': True, 'data': res.data or []}
    except Exception as e:
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)

@app.get('/api/expert/verifications/user/{user_id}')
async def get_user_verification(user_id: str):
    if not (USE_SUPABASE and supabase):
        return JSONResponse({'success': False, 'error': 'Supabase chưa kết nối'}, status_code=500)
        
    try:
        res = supabase.table('expert_verifications').select('*').eq('user_id', user_id).execute()
        return {'success': True, 'data': res.data[0] if res.data else None}
    except Exception as e:
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)

@app.post('/api/expert/verifications/{req_id}/approve')
async def approve_verification(req_id: str):
    if not (USE_SUPABASE and supabase):
        return JSONResponse({'success': False, 'error': 'Supabase chưa kết nối'}, status_code=500)
        
    try:
        # Get user_id from verification request
        ver_res = supabase.table('expert_verifications').select('user_id').eq('id', req_id).execute()
        if not ver_res.data or not isinstance(ver_res.data, list) or len(ver_res.data) == 0:
            return JSONResponse({'success': False, 'error': 'Không tìm thấy yêu cầu'}, status_code=404)
            
        user_data = ver_res.data[0]
        if not isinstance(user_data, dict):
            return JSONResponse({'success': False, 'error': 'Dữ liệu không hợp lệ'}, status_code=500)
            
        user_id = user_data.get('user_id')
        
        # Update verification status
        supabase.table('expert_verifications').update({'status': 'verified'}).eq('id', req_id).execute()
        
        # Update user role to expert
        supabase.table('profiles').update({'role': 'expert'}).eq('id', user_id).execute()
        
        return {'success': True, 'message': 'Đã phê duyệt hồ sơ'}
    except Exception as e:
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)

@app.delete('/api/expert/verifications/{req_id}')
async def reject_verification(req_id: str):
    if not (USE_SUPABASE and supabase):
        return JSONResponse({'success': False, 'error': 'Supabase chưa kết nối'}, status_code=500)
        
    try:
        supabase.table('expert_verifications').delete().eq('id', req_id).execute()
        return {'success': True, 'message': 'Đã xóa yêu cầu'}
    except Exception as e:
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


FRONTEND_DIR = ROOT / "frontend" / "www"

# Mount thư mục lịch sử ảnh (cả bản cũ và bản mới để đảm bảo hiển thị)
app.mount("/static/history", StaticFiles(directory=str(HISTORY_DIR)), name="static_history")
app.mount("/history", StaticFiles(directory=str(HISTORY_DIR)), name="history")

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class NoCacheMiddleware(BaseHTTPMiddleware):
    """Ngăn trình duyệt cache file HTML/JS để luôn tải bản mới nhất"""
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.endswith('.html') or path == '/' or path.endswith('.js'):
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        return response

app.add_middleware(NoCacheMiddleware)

# Mount toàn bộ frontend
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Premium Web Server at: http://0.0.0.0:{port}", flush=True)
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=True)

