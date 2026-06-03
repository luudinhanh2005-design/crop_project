-- Chạy đoạn mã này trong mục SQL Editor của Supabase Dashboard

CREATE TABLE IF NOT EXISTS public.expert_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    full_name TEXT,
    email TEXT,
    main_crop TEXT,
    experience TEXT,
    phone TEXT,
    degree_workplace TEXT,
    bio TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo policy để cho phép người dùng đọc và cập nhật dữ liệu của chính họ
ALTER TABLE public.expert_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép mọi người xem expert profiles" 
ON public.expert_profiles FOR SELECT 
USING (true);

CREATE POLICY "Chuyên gia tự cập nhật profile" 
ON public.expert_profiles FOR ALL 
USING (true) -- Có thể thay `true` bằng `auth.uid() = user_id` nếu bảng users đồng nhất với auth
WITH CHECK (true);

-- Cho phép insert
CREATE POLICY "Cho phép insert expert profiles" 
ON public.expert_profiles FOR INSERT 
WITH CHECK (true);
