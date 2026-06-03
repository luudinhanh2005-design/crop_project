-- ============================================================
-- NOTIFICATIONS SYSTEM - Supabase Schema
-- Dùng cho hệ thống thông báo real-time AgriSocial/AgriSocial
-- ============================================================

-- 1. Tạo bảng notifications (tương thích custom auth qua profiles)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,   -- Người NHẬN thông báo
    actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,  -- Người GÂY RA thông báo
    type TEXT NOT NULL,          -- 'like', 'comment', 'follow', 'alert', 'expert_answer', 'group_activity'
    post_id UUID,                -- Bài viết liên quan (nếu có)
    comment_text TEXT,           -- Nội dung bình luận (nếu type = 'comment')
    preview_url TEXT,            -- Ảnh thu nhỏ bài viết (nếu có)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Bật RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Policies (cho phép đọc/ghi qua API - auth xử lý ở backend)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow public read notifications') THEN
        CREATE POLICY "Allow public read notifications" ON public.notifications FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow public insert notifications') THEN
        CREATE POLICY "Allow public insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow public update notifications') THEN
        CREATE POLICY "Allow public update notifications" ON public.notifications FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow public delete notifications') THEN
        CREATE POLICY "Allow public delete notifications" ON public.notifications FOR DELETE USING (true);
    END IF;
END $$;

-- 4. Index để tăng tốc truy vấn theo user_id
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 5. Bật Realtime cho bảng notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
