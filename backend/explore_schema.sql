-- Đảm bảo bảng crop_library có cột views để xếp hạng Xu hướng
ALTER TABLE crop_library ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- Bảng Tin tức nổi bật (Hero Carousel và Tiêu điểm 2026)
CREATE TABLE IF NOT EXISTS explore_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    image_url VARCHAR(1024),
    badge VARCHAR(50),
    color VARCHAR(20) DEFAULT 'secondary',
    author VARCHAR(100),
    tags TEXT[], -- mảng chứa các tag
    is_hero BOOLEAN DEFAULT true, -- Nếu false thì sẽ cho vào mục 'Tiêu điểm'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Bộ sưu tập nổi bật
CREATE TABLE IF NOT EXISTS explore_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    article_count INTEGER DEFAULT 0,
    image_url VARCHAR(1024),
    is_featured BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Thêm dữ liệu mẫu vào Bảng Tin tức (Hero Carousel)
INSERT INTO explore_news (title, summary, image_url, badge, color, author, tags, is_hero)
VALUES 
('Sen Đá Kim Cương', 'Loài cây dễ chăm sóc, mang lại không gian xanh và tài lộc cho gia chủ. Đang là xu hướng được tìm kiếm.', 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=1200&q=80', 'CÂY CỦA NGÀY', 'secondary', 'KS. Mai Lan', ARRAY['Sen đá', 'Cây kiểng'], true),
('Mô hình trồng Cà Chua Thủy Canh', 'Tối ưu hóa không gian và nguồn nước, đem lại năng suất cao vượt trội.', 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=1200&q=80', 'MÔ HÌNH', 'primary', 'TS. Nguyễn B', ARRAY['Thủy canh', 'Công nghệ cao'], true),
('Giống lúa năng suất cao ứng phó biến đổi khí hậu', 'Nghiên cứu mới về các giống lúa chịu mặn và chịu hạn giúp nông dân Đồng bằng sông Cửu Long ổn định sản xuất trong điều kiện ngập mặn.', NULL, 'TIÊU ĐIỂM 2026', 'primary', 'Ban Biên Tập', ARRAY['Lúa', 'Biến đổi khí hậu'], false);

-- Thêm dữ liệu mẫu vào Bảng Bộ sưu tập
INSERT INTO explore_collections (title, article_count, image_url)
VALUES 
('Cây lọc không khí văn phòng', 12, 'https://images.unsplash.com/photo-1416879598555-27a92fb90234?auto=format&fit=crop&w=400&q=80'),
('Mẹo trị sâu bệnh hữu cơ', 8, 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&w=400&q=80'),
('Kỹ thuật ghép cành', 5, 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=400&q=80'),
('Phân bón tự chế', 15, 'https://images.unsplash.com/photo-1416879598555-27a92fb90234?auto=format&fit=crop&w=400&q=80');

-- Bật tính năng RLS (Row Level Security) - Cho phép đọc public, ghi cần auth
ALTER TABLE explore_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép đọc công khai trên explore_news" ON explore_news FOR SELECT USING (true);
CREATE POLICY "Cho phép đọc công khai trên explore_collections" ON explore_collections FOR SELECT USING (true);
