-- WanXin Userscripts 访问 / 安装统计
-- Cloudflare D1
--
-- 只记录匿名统计字段：
-- 不记录 IP、经纬度、邮编，也不建立用户身份标识。

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    script_id TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT 'XX',
    region TEXT NOT NULL DEFAULT '',
    region_code TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    timezone TEXT NOT NULL DEFAULT '',
    browser TEXT NOT NULL DEFAULT 'Other',
    os TEXT NOT NULL DEFAULT 'Other',
    device TEXT NOT NULL DEFAULT 'Other',
    referrer_host TEXT NOT NULL DEFAULT 'direct',
    hostname TEXT NOT NULL DEFAULT '',
    is_domestic INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_events_type
ON events(event_type);

CREATE INDEX IF NOT EXISTS idx_events_type_script
ON events(event_type, script_id);

CREATE INDEX IF NOT EXISTS idx_events_domestic_region
ON events(event_type, is_domestic, country, region_code);

CREATE INDEX IF NOT EXISTS idx_events_created
ON events(created_at);

CREATE INDEX IF NOT EXISTS idx_events_domestic_city
ON events(event_type, country, city);
