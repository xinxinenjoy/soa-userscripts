// Cloudflare Pages Function
// V4 统计事件采集
// 保存路径：functions/api/track.js
//
// D1 Binding 名称必须为：STATS_DB
// 只记录匿名汇总所需字段，不记录 IP、经纬度、邮编。

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

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!env.STATS_DB) {
        return json({ ok: false, error: "STATS_DB binding missing" }, 500);
    }

    // 仅接受本站页面发起的请求，降低接口被外部刷写的概率。
    const requestUrl = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (origin && origin !== requestUrl.origin) {
        return json({ ok: false, error: "invalid origin" }, 403);
    }

    const ua = request.headers.get("User-Agent") || "";
    if (looksLikeBot(ua)) {
        return json({ ok: true, ignored: "bot" });
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

    await env.STATS_DB.prepare(
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

    return json({ ok: true });
}

export async function onRequestGet() {
    return json({
        ok: true,
        endpoint: "WanXin Userscripts statistics tracker",
    });
}
