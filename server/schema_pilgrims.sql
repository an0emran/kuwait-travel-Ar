-- جدول المعتمرين
CREATE TABLE IF NOT EXISTS pilgrims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    passport_number TEXT UNIQUE,
    arrival_date DATE NOT NULL,
    agent_id INTEGER,
    sponsor_name TEXT,
    sponsor_phone TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id)
);

-- جدول التحذيرات
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pilgrim_id INTEGER,
    alert_type TEXT,
    message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pilgrim_id) REFERENCES pilgrims(id)
);
