// Cloudflare Pages Function
// 保存路径：functions/api/stats.js
//
// V5 首页统计（页面访问已由 track.js 做 48 小时同 IP 去重）：
// - 页面访问总次数
// - 脚本安装点击总次数
// - 国内地区 TOP 5
// - 中国大陆城市 TOP 5
// - 热门脚本 TOP 5
// - 最近 14 天页面访问 / 安装趋势
//
// D1 Binding 名称必须为：STATS_DB

const REGION_NAMES = {
    BJ: "北京",
    TJ: "天津",
    HE: "河北",
    SX: "山西",
    NM: "内蒙古",
    LN: "辽宁",
    JL: "吉林",
    HL: "黑龙江",
    SH: "上海",
    JS: "江苏",
    ZJ: "浙江",
    AH: "安徽",
    FJ: "福建",
    JX: "江西",
    SD: "山东",
    HA: "河南",
    HB: "湖北",
    HN: "湖南",
    GD: "广东",
    GX: "广西",
    HI: "海南",
    CQ: "重庆",
    SC: "四川",
    GZ: "贵州",
    YN: "云南",
    XZ: "西藏",
    SN: "陕西",
    GS: "甘肃",
    QH: "青海",
    NX: "宁夏",
    XJ: "新疆",
};

const COUNTRY_NAMES = {
    CN: "中国大陆",
    HK: "香港",
    MO: "澳门",
    TW: "台湾",
};

// Cloudflare 的 city 通常为英文 / 拼音。
// 只对常见国内城市做中文显示映射；未命中的城市保留 Cloudflare 原值。
const CITY_NAMES = {
    beijing: "北京",
    shanghai: "上海",
    tianjin: "天津",
    chongqing: "重庆",
    chengdu: "成都",
    shenzhen: "深圳",
    guangzhou: "广州",
    hangzhou: "杭州",
    nanjing: "南京",
    wuhan: "武汉",
    xian: "西安",
    "xi'an": "西安",
    suzhou: "苏州",
    changsha: "长沙",
    zhengzhou: "郑州",
    qingdao: "青岛",
    jinan: "济南",
    ningbo: "宁波",
    dongguan: "东莞",
    foshan: "佛山",
    hefei: "合肥",
    fuzhou: "福州",
    xiamen: "厦门",
    kunming: "昆明",
    nanchang: "南昌",
    shenyang: "沈阳",
    dalian: "大连",
    harbin: "哈尔滨",
    changchun: "长春",
    shijiazhuang: "石家庄",
    taiyuan: "太原",
    nanning: "南宁",
    haikou: "海口",
    guiYang: "贵阳",
    guiyang: "贵阳",
    lanzhou: "兰州",
    urumqi: "乌鲁木齐",
    hohhot: "呼和浩特",
    yinchuan: "银川",
    xining: "西宁",
    wenzhou: "温州",
    wuxi: "无锡",
    nantong: "南通",
    changzhou: "常州",
    shaoxing: "绍兴",
    jinhua: "金华",
    jiaxing: "嘉兴",
    quanzhou: "泉州",
    putian: "莆田",
    yantai: "烟台",
    weifang: "潍坊",
    linyi: "临沂",
    luoyang: "洛阳",
    nanyang: "南阳",
    yichang: "宜昌",
    xiangyang: "襄阳",
    zhuhai: "珠海",
    zhongshan: "中山",
    huizhou: "惠州",
    jiangmen: "江门",
    sanya: "三亚",
};

function json(data, status = 200) {
    return Response.json(data, {
        status,
        headers: {
            "Cache-Control": "public, max-age=30, s-maxage=60",
        },
    });
}

function countOf(row) {
    return Number(row?.count || 0);
}

function domesticRegionName(row) {
    const country = String(row?.country || "");

    if (country !== "CN" && COUNTRY_NAMES[country]) {
        return COUNTRY_NAMES[country];
    }

    const code = String(row?.region_code || "").toUpperCase();
    if (REGION_NAMES[code]) {
        return REGION_NAMES[code];
    }

    const raw = String(row?.region || "").trim();
    return raw || "未知地区";
}

function cityDisplayName(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return "未知城市";

    const normalized = raw
        .replace(/\s+City$/i, "")
        .replace(/\s+Shi$/i, "")
        .trim();

    const mapped = CITY_NAMES[normalized.toLowerCase()];
    return mapped || normalized;
}

function chinaDateKey(offsetDays = 0) {
    const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
    shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
    return shifted.toISOString().slice(0, 10);
}

function normalizeRecent14Days(rows) {
    const map = new Map(
        rows.map((row) => [
            String(row.date || ""),
            {
                visits: Number(row.visits || 0),
                installs: Number(row.installs || 0),
            },
        ])
    );

    const result = [];

    for (let offset = -13; offset <= 0; offset += 1) {
        const date = chinaDateKey(offset);
        const value = map.get(date) || { visits: 0, installs: 0 };

        result.push({
            date,
            visits: value.visits,
            installs: value.installs,
        });
    }

    return result;
}

async function rows(statement) {
    const result = await statement.all();
    return Array.isArray(result?.results) ? result.results : [];
}

export async function onRequestGet(context) {
    const { env } = context;

    if (!env.STATS_DB) {
        return json({ error: "STATS_DB binding missing" }, 500);
    }

    try {
        const [
            totalVisitsRow,
            totalInstallsRow,
            domesticRows,
            cityRows,
            scriptRows,
            browserRows,
            osRows,
            deviceRows,
            countryRows,
            referrerRows,
            recentRows,
        ] = await Promise.all([
            env.STATS_DB.prepare(
                `SELECT COUNT(*) AS count
                 FROM events
                 WHERE event_type = 'page_view'`
            ).first(),

            env.STATS_DB.prepare(
                `SELECT COUNT(*) AS count
                 FROM events
                 WHERE event_type = 'install_click'`
            ).first(),

            rows(
                env.STATS_DB.prepare(
                    `SELECT
                        country,
                        region,
                        region_code,
                        COUNT(*) AS count
                     FROM events
                     WHERE event_type = 'page_view'
                       AND is_domestic = 1
                     GROUP BY country, region, region_code
                     ORDER BY count DESC
                     LIMIT 12`
                )
            ),

            rows(
                env.STATS_DB.prepare(
                    `SELECT
                        city,
                        region_code,
                        COUNT(*) AS count
                     FROM events
                     WHERE event_type = 'page_view'
                       AND country = 'CN'
                       AND city <> ''
                     GROUP BY city, region_code
                     ORDER BY count DESC
                     LIMIT 10`
                )
            ),

            rows(
                env.STATS_DB.prepare(
                    `SELECT script_id, COUNT(*) AS count
                     FROM events
                     WHERE event_type = 'install_click'
                       AND script_id <> ''
                     GROUP BY script_id
                     ORDER BY count DESC`
                )
            ),

            rows(
                env.STATS_DB.prepare(
                    `SELECT browser AS name, COUNT(*) AS count
                     FROM events
                     WHERE event_type = 'page_view'
                     GROUP BY browser
                     ORDER BY count DESC
                     LIMIT 8`
                )
            ),

            rows(
                env.STATS_DB.prepare(
                    `SELECT os AS name, COUNT(*) AS count
                     FROM events
                     WHERE event_type = 'page_view'
                     GROUP BY os
                     ORDER BY count DESC
                     LIMIT 8`
                )
            ),

            rows(
                env.STATS_DB.prepare(
                    `SELECT device AS name, COUNT(*) AS count
                     FROM events
                     WHERE event_type = 'page_view'
                     GROUP BY device
                     ORDER BY count DESC
                     LIMIT 8`
                )
            ),

            rows(
                env.STATS_DB.prepare(
                    `SELECT country AS name, COUNT(*) AS count
                     FROM events
                     WHERE event_type = 'page_view'
                     GROUP BY country
                     ORDER BY count DESC
                     LIMIT 12`
                )
            ),

            rows(
                env.STATS_DB.prepare(
                    `SELECT referrer_host AS name, COUNT(*) AS count
                     FROM events
                     WHERE event_type = 'page_view'
                     GROUP BY referrer_host
                     ORDER BY count DESC
                     LIMIT 10`
                )
            ),

            rows(
                env.STATS_DB.prepare(
                    `SELECT
                        date(created_at, '+8 hours') AS date,
                        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS visits,
                        SUM(CASE WHEN event_type = 'install_click' THEN 1 ELSE 0 END) AS installs
                     FROM events
                     WHERE created_at >= datetime('now', '-15 days')
                     GROUP BY date(created_at, '+8 hours')
                     ORDER BY date ASC`
                )
            ),
        ]);

        const domesticRegions = domesticRows.map((row) => ({
            name: domesticRegionName(row),
            count: countOf(row),
        }));

        const domesticCities = cityRows.map((row) => ({
            name: cityDisplayName(row.city),
            count: countOf(row),
            regionCode: String(row.region_code || ""),
        }));

        const scriptInstalls = {};
        const topScripts = scriptRows.map((row) => {
            const scriptId = String(row.script_id || "");
            const count = countOf(row);
            scriptInstalls[scriptId] = count;
            return { scriptId, count };
        });

        const topRegion = domesticRegions[0] || null;

        return json({
            totalVisits: countOf(totalVisitsRow),
            totalInstalls: countOf(totalInstallsRow),

            // 首页展示
            topRegion,
            domesticRegions: domesticRegions.slice(0, 5),
            domesticCities: domesticCities.slice(0, 5),
            topScripts: topScripts.slice(0, 5),
            recent14Days: normalizeRecent14Days(recentRows),
            scriptInstalls,

            // 测试阶段保留，页面暂不展示
            browsers: browserRows.map((row) => ({
                name: String(row.name || "Other"),
                count: countOf(row),
            })),
            operatingSystems: osRows.map((row) => ({
                name: String(row.name || "Other"),
                count: countOf(row),
            })),
            devices: deviceRows.map((row) => ({
                name: String(row.name || "Other"),
                count: countOf(row),
            })),
            countries: countryRows.map((row) => ({
                code: String(row.name || "XX"),
                count: countOf(row),
            })),
            referrers: referrerRows.map((row) => ({
                name: String(row.name || "direct"),
                count: countOf(row),
            })),
        });
    } catch (error) {
        return json(
            {
                error: "statistics query failed",
                detail: String(error?.message || error),
            },
            500
        );
    }
}
