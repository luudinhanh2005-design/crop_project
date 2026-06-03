-- SQL for creating Calendar related tables in Supabase

-- 1. Master Seasonal Data (Quy trình canh tác chuẩn)
CREATE TABLE IF NOT EXISTS public.master_seasonal_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_key TEXT NOT NULL, -- 'rice', 'corn', 'cassava', etc.
    region TEXT NOT NULL,   -- 'ĐBSCL', 'Tây Nguyên', 'Miền Bắc'
    planting_season TEXT,   -- 'Đông Xuân', 'Hè Thu'
    stages JSONB NOT NULL,  -- Danh sách các bước: [{ "title": "Bón phân", "offset_days": 15, "important": true }]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. User Crops (Cây trồng của người dùng)
CREATE TABLE IF NOT EXISTS public.user_crops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    crop_key TEXT NOT NULL,
    planting_date DATE NOT NULL,
    region TEXT NOT NULL,
    status TEXT DEFAULT 'growing', -- 'growing', 'harvested'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Crop Tasks (Công việc cụ thể của người dùng)
CREATE TABLE IF NOT EXISTS public.crop_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_crop_id UUID REFERENCES public.user_crops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    is_important BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.master_seasonal_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_tasks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view master seasonal data" ON public.master_seasonal_data FOR SELECT USING (true);

CREATE POLICY "Users can manage their own crops" ON public.user_crops
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own tasks" ON public.crop_tasks
    FOR ALL USING (auth.uid() = user_id);
