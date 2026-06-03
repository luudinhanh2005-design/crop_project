from ultralytics import YOLO
import sys
from pathlib import Path

# Thêm đường dẫn thư mục gốc vào hệ thống
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

def main():
    print("=" * 55)
    print("  Huấn luyện YOLOv8 - Chẩn đoán Bệnh học Cây trồng")
    print("=" * 55)
    
    # Nạp mô hình pre-trained YOLOv8 Nano nhẹ và tối ưu nhất cho thiết bị di động/nhúng
    model = YOLO("yolov8n.pt")
    
    import torch
    device = 0 if torch.cuda.is_available() else "cpu"
    print(f"--> Thiet bi su dung de huan luyen: {device} (GPU CUDA: {torch.cuda.is_available()})")
    if device == "cpu":
        print("[LƯU Ý] PyTorch cua ban dang chay tren CPU. Neu may co GPU NVIDIA, hay cai phien ban PyTorch ho tro CUDA de train nhanh hon.")
    
    # Bắt đầu quá trình huấn luyện
    model.train(
        data="dataset.yaml",
        epochs=150,
        patience=20,
        imgsz=640,
        batch=8,
        workers=2,
        device=device
    )
    print("\n[DONE] Huấn luyện hoàn thành!")
    print("Mô hình tốt nhất được lưu tại: runs/detect/train/weights/best.pt")

if __name__ == "__main__":
    main()
