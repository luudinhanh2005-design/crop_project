# Hướng dẫn đồng nghiệp: Huấn luyện và Đồng bộ YOLOv8 (16 Lớp bệnh học)

Tài liệu này hướng dẫn cách mở rộng mô hình YOLOv8 từ **4 lớp bệnh** hiện tại lên **16 lớp bệnh** đầy đủ để hiển thị đúng khung bao vết bệnh trên giao diện ứng dụng AgriSocial.

---

## BƯỚC 1: Gán nhãn dữ liệu (Data Annotation)
Đồng nghiệp cần chuẩn bị ảnh chụp các lá/thân bị bệnh của các cây: Khoai lang, khoai tây, lúa mì, mía, sắn, đậu nành. Sau đó tiến hành vẽ khung bao (Bounding Box) và gán nhãn cho 12 loại bệnh bổ sung:
*   **Danh sách 12 bệnh cần gán thêm**:
    *   *Khoai lang*: Thối đen (sweet_potato_black_rot), Ghẻ (sweet_potato_scab)
    *   *Khoai tây*: Mốc sương (potato_late_blight), Cháy sớm (potato_early_blight)
    *   *Lúa mì*: Rỉ sắt (wheat_rust), Đốm Septoria (wheat_septoria)
    *   *Mía*: Thối đỏ (sugarcane_red_rot), Rỉ sắt (sugarcane_rust)
    *   *Sắn*: Khảm lá (cassava_mosaic), Cháy lá vi khuẩn (cassava_bacterial_blight)
    *   *Đậu nành*: Rỉ sắt (soybean_rust), Cháy lá (soybean_blight)

*   **Định dạng nhãn**: Xuất ra định dạng **YOLO v8** (file `.txt` tương ứng với mỗi ảnh, chứa thông tin lớp và tọa độ chuẩn hóa).

---

## BƯỚC 2: Đồng bộ cấu hình file `dataset.yaml`
Để tránh bị lệch pha dữ liệu giữa mô hình AI và code xử lý API, bắt buộc phải khai báo danh sách 16 lớp trong file `dataset.yaml` theo **đúng thứ tự chỉ mục** sau:

```yaml
# dataset.yaml
path: dataset
train: images/train
val: images/val

names:
  0: rice_blast
  1: rice_bacterial_blight
  2: corn_rust
  3: corn_blight
  4: sweet_potato_black_rot
  5: sweet_potato_scab
  6: potato_late_blight
  7: potato_early_blight
  8: wheat_rust
  9: wheat_septoria
  10: sugarcane_red_rot
  11: sugarcane_rust
  12: cassava_mosaic
  13: cassava_bacterial_blight
  14: soybean_rust
  15: soybean_blight
```

*Chú ý: Không được đảo lộn thứ tự các số từ 0 đến 15, nếu không kết quả vẽ khung bao trên UI sẽ bị râu ông nọ cắm cằm bà kia.*

---

## BƯỚC 3: Huấn luyện lại YOLOv8
Mở Terminal của dự án và chạy kịch bản huấn luyện:
```powershell
# Kích hoạt môi trường và chạy train
venv_gpu\Scripts\python.exe train_yolo.py
```
*   Kịch bản sẽ tự động chạy trong 150 epochs (có dừng sớm nếu hội tụ).
*   Mô hình tốt nhất sau khi huấn luyện sẽ nằm ở đường dẫn: `runs/detect/train/weights/best.pt`.

---

## BƯỚC 4: Triển khai mô hình mới lên server
Sau khi huấn luyện thành công:
1.  Copy file `best.pt` mới thu được.
2.  Dán đè (Overwrite) vào đường dẫn: `backend/models/best_yolo_v1.pt` (hoặc `models/best_yolo_v1.pt` tùy cấu hình thư mục gốc).
3.  Khởi động lại API server. API sẽ tự động nhận diện mô hình có 16 lớp và kích hoạt tính năng vẽ khung bao bệnh hại cho tất cả các cây trồng.
