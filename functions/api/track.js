// Cloudflare Pages Function
// V6 统计事件采集
// 保存路径：functions/api/track.js
//
// 页面访问统计规则：
// - 以“匿名浏览器设备 ID + 当前公网 IP”作为一次访问设备的临时去重键。
// - 同一设备、同一公网 IP 在 8 小时内重复访问，只计 1 次 page_view。
// - 同一公网 IP 下，不同设备 / 不同浏览器配置可分别计数。
// - 同一设备切换公网 IP 后，会按新的网络环境重新计数。
// - install_click 不做去重，每次点击“立即安装”都正常累计。
// - 不保存原始 IP，也不保存客户端匿名设备 ID。
// - D1 仅保存 HMAC-SHA256 后的 visitor_key，并自动清理旧记录。
//
// 说明：匿名设备 ID 由首页在浏览器本地生成并保存，不读取硬件序列号，
//      也不进行 Canvas / 字体等浏览器指纹采集。
//
// D1 Binding：STATS_DB
// Secret / 环境变量：VISITOR_HASH_SECRET

const PAGE_VIEW_DEDUPE_HOURS = 8;
const VISITOR_RETENTION_HOURS = 24;

const DOMESTIC_COUNTRIES = new Set(["CN", "HK", "MO", "TW"]);

function json(data, status = 200) {
    return Response.json(data, {
        status,
        headers: {
            "Cache-Control": "no-store",
        },
    });
}

function clean(value, maxLength = 120) {
    return String(value || "").trim().slice(0, maxLength);
}

function parseUserAgent(ua) {
    const value = String(ua || "");

    let browser = "Other";
    if (/Edg\//i.test(value)) browser = "Edge";
    else if (/Firefox\//i.test(value)) browser = "Firefox";
    else if (/Chrome\//i.test(value) || /Chromium\//i.test(value)) browser = "Chrome";
    else if (/Safari\//i.test(value) && /Version\//i.test(value)) browser = "Safari";

    let os = "Other";
    if (/Windows NT/i.test(value)) os = "Windows";
    else if (/Android/i.test(value)) os = "Android";
    else if (/iPhone|iPad|iPod/i.test(value)) os = "iOS";
    else if (/Mac OS X|Macintosh/i.test(value)) os = "macOS";
    else if (/Linux/i.test(value)) os = "Linux";

    let device = "Desktop";
    if (/iPad|Tablet/i.test(value)) device = "Tablet";
    else if (/Mobile|Android|iPhone|iPod/i.test(value)) device = "Mobile";

    return { browser, os, device };
}

function referrerHost(request) {
    const raw = request.headers.get("Referer");
    if (!raw) return "direct";

    try {
        return new URL(raw).hostname || "direct";
    } catch {
        return "unknown";
    }
}

function looksLikeBot(ua) {
    return /bot|crawler|spider|slurp|headless|lighthouse|preview|facebookexternalhit|bingpreview/i.test(
        String(ua || "")
    );
}

function getClientIp(request) {
    // 原始公网 IP 只在当前请求内用于生成 HMAC，不写入数据库。
    return clean(request.headers.get("CF-Connecting-IP"), 80);
}

function normalizeDeviceId(value) {
    const id = clean(value, 120);

    // 首页生成的 ID 只允许常见 UUID / 随机 token 字符。
    // 无效值直接忽略，避免把任意长文本参与 visitor_key。
    if (!/^[A-Za-z0-9._:-]{8,120}$/.test(id)) {
        return "";
    }

    return id;
}

async function makeVisitorKey({ ip, deviceId, ua, secret }) {
    if (!ip || !secret) return "";

    // 正常情况使用匿名设备 ID。
    // 如果浏览器阻止本地存储导致 deviceId 缺失，退化为 UA，
    // 仍保留一定的去重能力，但同网络同 UA 的设备可能被合并。
    const devicePart = deviceId || `ua:${clean(ua, 280)}`;
    const source = `${ip}\n${devicePart}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        {
            name: "HMAC",
            hash: "SHA-256",
        },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(source)
    );

    return Array.from(new Uint8Array(signature))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function shouldCountPageView(db, visitorKey) {
    if (!visitorKey) {
        // 无法得到去重键时 fail-open，避免异常环境完全漏记访问。
        return true;
    }

    const recent = await db.prepare(
        `SELECT 1 AS found
         FROM page_visitors
         WHERE visitor_key = ?
           AND last_counted_at >= strftime(
               '%Y-%m-%dT%H:%M:%fZ',
               'now',
               ?
           )
         LIMIT 1`
    )
        .bind(visitorKey, `-${PAGE_VIEW_DEDUPE_HOURS} hours`)
        .first();

    if (recent?.found) {
        return false;
    }

    await db.prepare(
        `INSERT INTO page_visitors (
            visitor_key,
            last_counted_at
        ) VALUES (
            ?,
            strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        ON CONFLICT(visitor_key)
        DO UPDATE SET
            last_counted_at = excluded.last_counted_at`
    )
        .bind(visitorKey)
        .run();

    // visitor_key 仅用于短期去重，不长期保存。
    await db.prepare(
        `DELETE FROM page_visitors
         WHERE last_counted_at < strftime(
             '%Y-%m-%dT%H:%M:%fZ',
             'now',
             ?
         )`
    )
        .bind(`-${VISITOR_RETENTION_HOURS} hours`)
        .run();

    return true;
}

async function insertEvent({ db, eventType, scriptId, request }) {
    const requestUrl = new URL(request.url);
    const ua = request.headers.get("User-Agent") || "";
    const cf = request.cf || {};

    const country = clean(cf.country || "XX", 8);
    const region = clean(cf.region || "", 80);
    const regionCode = clean(cf.regionCode || "", 16);
    const city = clean(cf.city || "", 80);
    const timezone = clean(cf.timezone || "", 80);

    const { browser, os, device } = parseUserAgent(ua);
    const referrer = clean(referrerHost(request), 160);
    const hostname = clean(requestUrl.hostname, 160);
    const isDomestic = DOMESTIC_COUNTRIES.has(country) ? 1 : 0;

    await db.prepare(
        `INSERT INTO events (
            event_type,
            script_id,
            country,
            region,
            region_code,
            city,
            timezone,
            browser,
            os,
            device,
            referrer_host,
            hostname,
            is_domestic
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(
            eventType,
            scriptId,
            country,
            region,
            regionCode,
            city,
            timezone,
            browser,
            os,
            device,
            referrer,
            hostname,
            isDomestic
        )
        .run();
}

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!env.STATS_DB) {
        return json({ ok: false, error: "STATS_DB binding missing" }, 500);
    }

    const requestUrl = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (origin && origin !== requestUrl.origin) {
        return json({ ok: false, error: "invalid origin" }, 403);
    }

    const ua = request.headers.get("User-Agent") || "";

    if (looksLikeBot(ua)) {
        return json({ ok: true, counted: false, ignored: "bot" });
    }

    let body = {};

    try {
        const raw = await request.text();
        body = raw ? JSON.parse(raw) : {};
    } catch {
        return json({ ok: false, error: "invalid json" }, 400);
    }

    const eventType = clean(body.eventType, 32);

    if (!["page_view", "install_click"].includes(eventType)) {
        return json({ ok: false, error: "invalid event" }, 400);
    }

    const scriptId =
        eventType === "install_click"
            ? clean(body.scriptId, 96)
            : "";

    if (eventType === "install_click" && !scriptId) {
        return json({ ok: false, error: "script id required" }, 400);
    }

    // ========================================================
    // 页面访问：同设备 + 同公网 IP，8 小时内只计 1 次
    // ========================================================
    if (eventType === "page_view") {
        if (!env.VISITOR_HASH_SECRET) {
            return json(
                { ok: false, error: "VISITOR_HASH_SECRET missing" },
                500
            );
        }

        const ip = getClientIp(request);
        const deviceId = normalizeDeviceId(body.deviceId);
        const visitorKey = await makeVisitorKey({
            ip,
            deviceId,
            ua,
            secret: env.VISITOR_HASH_SECRET,
        });

        const countThisVisit = await shouldCountPageView(
            env.STATS_DB,
            visitorKey
        );

        if (!countThisVisit) {
            return json({
                ok: true,
                counted: false,
                ignored: "duplicate_page_view",
                dedupeHours: PAGE_VIEW_DEDUPE_HOURS,
                dedupeScope: "same_device_same_ip",
            });
        }

        await insertEvent({
            db: env.STATS_DB,
            eventType,
            scriptId: "",
            request,
        });

        return json({
            ok: true,
            counted: true,
            eventType,
            dedupeHours: PAGE_VIEW_DEDUPE_HOURS,
        });
    }

    // ========================================================
    // 安装点击：不做去重，每次点击都计数
    // ========================================================
    await insertEvent({
        db: env.STATS_DB,
        eventType,
        scriptId,
        request,
    });

    return json({
        ok: true,
        counted: true,
        eventType,
        scriptId,
    });
}

export async function onRequestGet() {
    return json({
        ok: true,
        endpoint: "WanXin Userscripts statistics tracker",
        pageViewRule: `same browser device + same IP counted once per ${PAGE_VIEW_DEDUPE_HOURS} hours`,
        installRule: "every install click is counted",
        privacy: "raw IP and client device ID are not stored",
    });
}
