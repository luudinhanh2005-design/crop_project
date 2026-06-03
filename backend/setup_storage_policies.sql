-- Chạy đoạn mã này trong SQL Editor của Supabase Dashboard
-- Script này cấp quyền truy cập (Upload và Xem) cho bucket 'crop-images'

-- 1. Cho phép bất kỳ ai cũng có quyền upload file vào bucket crop-images
CREATE POLICY "Cho phép mọi người upload ảnh" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'crop-images');

-- 2. Cho phép bất kỳ ai cũng có thể xem/đọc file từ bucket crop-images
CREATE POLICY "Cho phép mọi người xem ảnh" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'crop-images');

-- 3. (Tuỳ chọn) Cho phép người dùng xoá/cập nhật ảnh (cần thiết nếu muốn ghi đè avatar)
CREATE POLICY "Cho phép cập nhật ảnh" 
ON storage.objects FOR UPDATE 
TO public 
USING (bucket_id = 'crop-images');

CREATE POLICY "Cho phép xoá ảnh" 
ON storage.objects FOR DELETE 
TO public 
USING (bucket_id = 'crop-images');
