-- Chạy đoạn mã này trong mục SQL Editor của Supabase Dashboard

-- Thêm cột rating vào bảng expert_responses
ALTER TABLE public.expert_responses ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating >= 1 AND rating <= 5);

-- (Tuỳ chọn) Nếu bạn muốn reset rating về null cho các record cũ
-- UPDATE public.expert_responses SET rating = NULL WHERE rating IS NOT NULL;
