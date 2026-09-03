// Cloudflare Pages Function
// V5 统计事件采集
// 保存路径：functions/api/track.js
//
// 页面访问统计规则：
// - 同一公网 IP 在 48 小时内重复访问，只计 1 次 page_view。
// - 48 小时后再次访问，可重新计 1 次。
// - install_click 不做 IP 去重，每次点击“立即安装”都正常统计。
// - 不保存原始 IP。
// - 仅保存 HMAC-SHA256 后的临时 visitor_key，并自动清理旧记录。
//
// D1 Binding：STATS_DB
// Secret / 环境变量：VISITOR_HASH_SECRET

const PAGE_VIEW_DEDUPE_HOURS = 48;
const VISITOR_RETENTION_HOURS = 72;

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
    // 在 Cloudflare Pages / Workers 中，CF-Connecting-IP 是访问者公网 IP。
    // 原始 IP 只在当前请求内用于生成 HMAC，不写入数据库。
    return clean(request.headers.get("CF-Connecting-IP"), 80);
}

async function makeVisitorKey(ip, secret) {
    if (!ip || !secret) return "";

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
        encoder.encode(ip)
    );

    return Array.from(new Uint8Array(signature))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function shouldCountPageView(db, visitorKey) {
    if (!visitorKey) {
        // 无法取得 visitor_key 时采用 fail-open：
        // 正常统计这次访问，避免因为异常环境完全漏记。
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
        .bind(
            visitorKey,
            `-${PAGE_VIEW_DEDUPE_HOURS} hours`
        )
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

    // visitor_key 只用于短期去重。
    // 保留时间略长于去重窗口，避免长期保存可关联标识。
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

async function insertEvent({
    db,
    eventType,
    scriptId,
    request,
}) {
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
        return json(
            {
                ok: false,
                error: "STATS_DB binding missing",
            },
            500
        );
    }

    // 仅接受本站页面发起的请求，降低接口被外部刷写的概率。
    const requestUrl = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (origin && origin !== requestUrl.origin) {
        return json(
            {
                ok: false,
                error: "invalid origin",
            },
            403
        );
    }

    const ua = request.headers.get("User-Agent") || "";

    if (looksLikeBot(ua)) {
        return json({
            ok: true,
            counted: false,
            ignored: "bot",
        });
    }

    let body = {};

    try {
        const raw = await request.text();
        body = raw ? JSON.parse(raw) : {};
    } catch {
        return json(
            {
                ok: false,
                error: "invalid json",
            },
            400
        );
    }

    const eventType = clean(body.eventType, 32);

    if (!["page_view", "install_click"].includes(eventType)) {
        return json(
            {
                ok: false,
                error: "invalid event",
            },
            400
        );
    }

    const scriptId =
        eventType === "install_click"
            ? clean(body.scriptId, 96)
            : "";

    if (eventType === "install_click" && !scriptId) {
        return json(
            {
                ok: false,
                error: "script id required",
            },
            400
        );
    }

    // ========================================================
    // 页面访问：同公网 IP 48 小时内只计 1 次
    // ========================================================

    if (eventType === "page_view") {
        if (!env.VISITOR_HASH_SECRET) {
            return json(
                {
                    ok: false,
                    error: "VISITOR_HASH_SECRET missing",
                },
                500
            );
        }

        const ip = getClientIp(request);
        const visitorKey = await makeVisitorKey(
            ip,
            env.VISITOR_HASH_SECRET
        );

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
        });
    }

    // ========================================================
    // 安装点击：不做 IP 去重，每次点击都计数
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
        pageViewRule: `same IP counted once per ${PAGE_VIEW_DEDUPE_HOURS} hours`,
        installRule: "every install click is counted",
    });
}
