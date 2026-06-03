import sys
from pathlib import Path
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

def main():
    # Kiểm tra sự tồn tại của mô hình tốt nhất (best.pt), nếu chưa train thì dùng yolov8n.pt mặc định
    model_path = ROOT / "runs" / "detect" / "train" / "weights" / "best.pt"
    if not model_path.exists():
        print(f"[WARN] Chưa có mô hình tốt nhất tại runs/, sử dụng tạm yolov8n.pt mặc định...")
        model = YOLO("yolov8n.pt")
    else:
        model = YOLO(str(model_path))
        print(f"[OK] Đang chạy mô hình YOLOv8: {model_path.name}")
        
    # Thử nghiệm trên ảnh lúa bị bệnh trong lịch sử quét
    test_img = ROOT / "frontend" / "history" / "788ecbb1-1f02-4242-b53d-9e10f2a517ec.jpg"
    if not test_img.exists():
        print(f"[ERR] Không tìm thấy ảnh test tại: {test_img}")
        return
        
    print(f"Đang quét thử ảnh: {test_img.name}...")
    results = model(str(test_img))
    
    # Trích xuất dữ liệu hộp phát hiện
    for result in results:
        boxes = result.boxes
        if len(boxes) == 0:
            print("Không phát hiện đốm bệnh nào.")
            continue
            
        for i, box in enumerate(boxes):
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0]
            label = model.names[cls_id]
            print(f"Đốm {i+1}: Nhãn: '{label}' | Độ tin cậy: {conf*100:.1f}% | Tọa độ BBox: [{x1:.1f}, {y1:.1f}, {x2:.1f}, {y2:.1f}]")
            
    # Hiển thị ảnh kết quả nếu hệ thống có giao diện đồ họa
    try:
        results[0].show()
    except Exception as e:
        print("[INFO] Không thể hiển thị cửa sổ GUI xem ảnh kết quả (Môi trường Console).")

if __name__ == "__main__":
    main()
