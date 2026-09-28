-- نظام التوصيات المستوحى من X
-- جدول لتتبع تفاعلات المستخدمين

CREATE TABLE IF NOT EXISTS user_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    interaction_type TEXT NOT NULL, -- 'view', 'click', 'book', 'favorite'
    destination_name TEXT,
    service_type TEXT, -- 'umrah', 'hajj', 'ticket', 'visa'
    metadata TEXT, -- JSON للبيانات الإضافية
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created ON user_interactions(created_at);

-- جدول لشعبية الوجهات
CREATE TABLE IF NOT EXISTS destination_popularity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destination_name TEXT NOT NULL UNIQUE,
    service_type TEXT NOT NULL,
    view_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    booking_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    popularity_score REAL DEFAULT 0.0,
    category TEXT, -- 'religious', 'leisure', 'business'
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_destination_popularity_score ON destination_popularity(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_destination_service_type ON destination_popularity(service_type);

-- جدول للتوصيات المخزنة (cache)
CREATE TABLE IF NOT EXISTS user_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recommended_destinations TEXT NOT NULL, -- JSON array
    algorithm_version TEXT DEFAULT 'v1.0',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_recommendations_user ON user_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_expires ON user_recommendations(expires_at);

-- إدراج بيانات أ ولية للوجهات الشهيرة
INSERT OR IGNORE INTO destination_popularity (destination_name, service_type, view_count, booking_count, category) VALUES
('مكة المكرمة', 'umrah', 1000, 500, 'religious'),
('المدينة المنورة', 'umrah', 900, 450, 'religious'),
('القاهرة', 'ticket', 300, 100, 'business'),
('دبي', 'ticket', 500, 200, 'leisure'),
('إسطنبول', 'ticket', 400, 150, 'leisure'),
('بانكوك', 'ticket', 250, 80, 'leisure'),
('الرياض', 'ticket', 350, 120, 'business');

-- تحديث نقاط الشعبية الأولية
UPDATE destination_popularity 
SET popularity_score = (view_count * 0.1) + (click_count * 0.3) + (booking_count * 1.0) + (favorite_count * 0.5);
