from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
import sqlite3
import uuid
import shutil
from typing import Optional
from pathlib import Path

ROOT = Path(__file__).parent.parent
DB_PATH = ROOT / "auth.db"

# Thư mục lưu ảnh chứng chỉ
CERT_UPLOAD_DIR = ROOT.parent / "frontend" / "cert_uploads"
CERT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/api/expert", tags=["Expert"])

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def migrate_cert_image_column():
    """Thêm cột cert_image_url nếu chưa tồn tại (migration an toàn)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE expert_verifications ADD COLUMN cert_image_url TEXT")
        conn.commit()
        conn.close()
    except Exception:
        pass  # Column already exists

# Run migration on import
migrate_cert_image_column()


@router.post("/verification")
async def submit_verification(
    user_id: str = Form(...),
    full_name: str = Form(...),
    cert_name: str = Form(...),
    cert_image: Optional[UploadFile] = File(None)
):
    try:
        # Save uploaded image if provided
        image_url = None
        if cert_image and cert_image.filename:
            ext = Path(cert_image.filename).suffix.lower() or ".jpg"
            save_name = f"{user_id}_{uuid.uuid4().hex[:8]}{ext}"
            save_path = CERT_UPLOAD_DIR / save_name
            with open(save_path, "wb") as f:
                shutil.copyfileobj(cert_image.file, f)
            image_url = f"/cert_uploads/{save_name}"

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if already exists
        cursor.execute("SELECT id FROM expert_verifications WHERE user_id = ?", (user_id,))
        existing = cursor.fetchone()

        if existing:
            if image_url:
                cursor.execute("""
                    UPDATE expert_verifications
                    SET cert_name = ?, full_name = ?, status = 'pending',
                        cert_image_url = ?, created_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                """, (cert_name, full_name, image_url, user_id))
            else:
                cursor.execute("""
                    UPDATE expert_verifications
                    SET cert_name = ?, full_name = ?, status = 'pending', created_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                """, (cert_name, full_name, user_id))
        else:
            req_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO expert_verifications (id, user_id, full_name, cert_name, cert_image_url, status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            """, (req_id, user_id, full_name, cert_name, image_url))

        conn.commit()
        conn.close()
        return {"success": True, "message": "Gửi yêu cầu xác minh thành công", "image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verifications")
def get_pending_verifications():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id, full_name, cert_name, cert_image_url, status, created_at "
            "FROM expert_verifications WHERE status = 'pending' ORDER BY created_at DESC"
        )
        rows = cursor.fetchall()
        conn.close()

        results = []
        for r in rows:
            results.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "full_name": r["full_name"],
                "cert_name": r["cert_name"],
                "cert_image_url": r["cert_image_url"],
                "status": r["status"],
                "created_at": r["created_at"]
            })
        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verifications/{req_id}/approve")
def approve_verification(req_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT user_id FROM expert_verifications WHERE id = ?", (req_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu")

        user_id = row["user_id"]
        cursor.execute("UPDATE expert_verifications SET status = 'verified' WHERE id = ?", (req_id,))
        cursor.execute("UPDATE custom_users SET role = 'expert' WHERE id = ?", (user_id,))

        conn.commit()
        conn.close()
        return {"success": True, "message": "Đã phê duyệt hồ sơ"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/verifications/{req_id}")
def reject_verification(req_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM expert_verifications WHERE id = ?", (req_id,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Đã xóa yêu cầu"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
