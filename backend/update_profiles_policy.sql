-- Chạy đoạn mã này trong SQL Editor của Supabase để chắc chắn người dùng được phép cập nhật ảnh đại diện của chính mình trong bảng profiles chung

-- Cho phép người dùng tự cập nhật thông tin của họ trong bảng profiles
CREATE POLICY "Cho phép người dùng tự cập nhật profile" 
ON public.profiles FOR UPDATE 
TO public 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
