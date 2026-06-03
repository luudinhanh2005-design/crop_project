-- Create expert_verifications table if not exists
CREATE TABLE IF NOT EXISTS public.expert_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    cert_name TEXT NOT NULL,
    cert_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, verified, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bật RLS
ALTER TABLE public.expert_verifications ENABLE ROW LEVEL SECURITY;

-- Các chính sách bảo mật:
-- 1. Cho phép bất kỳ ai đọc dữ liệu xác minh (hoặc có thể chỉ giới hạn admin, nhưng read all cho đơn giản)
CREATE POLICY "Cho phép đọc mọi yêu cầu" ON public.expert_verifications
    FOR SELECT USING (true);

-- 2. Cho phép insert mọi yêu cầu (vì người dùng chưa xác thực hoặc đã xác thực đều có thể gửi)
CREATE POLICY "Cho phép insert yêu cầu" ON public.expert_verifications
    FOR INSERT WITH CHECK (true);

-- 3. Cho phép tự update yêu cầu của mình hoặc update mọi yêu cầu
CREATE POLICY "Cho phép update yêu cầu" ON public.expert_verifications
    FOR UPDATE USING (true);

-- 4. Cho phép delete (Dành cho admin hoặc người dùng tự hủy yêu cầu)
CREATE POLICY "Cho phép delete yêu cầu" ON public.expert_verifications
    FOR DELETE USING (true);
