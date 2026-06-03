-- Lệnh SQL để thêm cột target_expert_id vào bảng expert_requests trên Supabase
ALTER TABLE public.expert_requests ADD COLUMN IF NOT EXISTS target_expert_id UUID;
