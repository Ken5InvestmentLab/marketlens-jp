const TDNET_BASE_URL = "https://www.release.tdnet.info/inbs";
const JQUANTS_BASE_URL = "https://api.jquants.com";
const API_CACHE_SECONDS = 180;
const MAX_DAYS = 7;
const MAX_LIMIT = 300;
const MAX_TDNET_PAGES = 8;

const JPX_HOLIDAYS_2026 = [
  ["2026-01-01", "元日"],
  ["2026-01-02", "市場休日"],
  ["2026-01-03", "市場休日"],
  ["2026-01-12", "成人の日"],
  ["2026-02-11", "建国記念の日"],
  ["2026-02-23", "天皇誕生日"],
  ["2026-03-20", "春分の日"],
  ["2026-04-29", "昭和の日"],
  ["2026-05-03", "憲法記念日"],
  ["2026-05-04", "みどりの日"],
  ["2026-05-05", "こどもの日"],
  ["2026-05-06", "憲法記念日 振替休日"],
  ["2026-07-20", "海の日"],
  ["2026-08-11", "山の日"],
  ["2026-09-21", "敬老の日"],
  ["2026-09-22", "国民の休日"],
  ["2026-09-23", "秋分の日"],
  ["2026-10-12", "スポーツの日"],
  ["2026-11-03", "文化の日"],
  ["2026-11-23", "勤労感謝の日"],
  ["2026-12-31", "市場休日"],
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/status") {
      return jsonResponse({
        ok: true,
        generatedAt: new Date().toISOString(),
        sources: {
          tdnetPublic: true,
          jquantsConfigured: Boolean(env.JQUANTS_API_KEY),
        },
      });
    }

    if (url.pathname === "/api/disclosures") {
      return withCache(request, ctx, () => handleDisclosures(url, env));
    }

    if (url.pathname === "/api/calendar") {
      return withCache(request, ctx, () => handleCalendar(url, env));
    }

    return env.ASSETS.fetch(request);
  },
};

async function withCache(request, ctx, handler) {
  const cacheKey = new Request(request.url, request);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const response = await handler();
  if (response.ok) {
    const cachedResponse = new Response(response.body, response);
    cachedResponse.headers.set("Cache-Control", `public, max-age=60, s-maxage=${API_CACHE_SECONDS}`);
    ctx.waitUntil(caches.default.put(cacheKey, cachedResponse.clone()));
    return cachedResponse;
  }

  return response;
}

async function handleDisclosures(url, env) {
  const today = tokyoToday();
  const date = validDate(url.searchParams.get("date")) || today;
  const days = clamp(Number(url.searchParams.get("days") || 1), 1, MAX_DAYS);
  const limit = clamp(Number(url.searchParams.get("limit") || 120), 1, MAX_LIMIT);
  const source = url.searchParams.get("source") || "auto";

  if (env.JQUANTS_API_KEY && source !== "tdnet-public") {
    try {
      const disclosures = await fetchJquantsDisclosures(env, date, days, limit);
      return jsonResponse({
        source: "jquants-tdnet",
        generatedAt: new Date().toISOString(),
        disclosures,
      });
    } catch (error) {
      console.warn(JSON.stringify({ event: "jquants_tdnet_failed", message: error.message }));
      if (source === "jquants") {
        return errorResponse("J-Quants TDnet APIの取得に失敗しました", 502);
      }
    }
  }

  const disclosures = await fetchPublicTdnetDisclosures(date, days, limit);
  return jsonResponse({
    source: "tdnet-public",
    generatedAt: new Date().toISOString(),
    disclosures,
  });
}

async function handleCalendar(url, env) {
  const from = validDate(url.searchParams.get("from")) || tokyoToday();
  const days = clamp(Number(url.searchParams.get("days") || 45), 1, 180);
  const to = validDate(url.searchParams.get("to")) || addDays(from, days);
  const events = marketHolidayEvents(from, to);
  const sources = ["jpx-market-holidays-static"];

  if (env.JQUANTS_API_KEY) {
    const [tradingEvents, earningsEvents] = await Promise.allSettled([
      fetchJquantsTradingCalendar(env, from, to),
      fetchJquantsEarningsCalendar(env, from, to),
    ]);

    if (tradingEvents.status === "fulfilled") {
      events.push(...tradingEvents.value);
      sources.push("jquants-trading-calendar");
    } else {
      console.warn(JSON.stringify({ event: "jquants_trading_calendar_failed", message: tradingEvents.reason?.message }));
    }

    if (earningsEvents.status === "fulfilled") {
      events.push(...earningsEvents.value);
      sources.push("jquants-earnings-calendar");
    } else {
      console.warn(JSON.stringify({ event: "jquants_earnings_calendar_failed", message: earningsEvents.reason?.message }));
    }
  }

  return jsonResponse({
    source: sources.join("+"),
    generatedAt: new Date().toISOString(),
    events: dedupeEvents(events).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
  });
}

export async function fetchPublicTdnetDisclosures(startDate, days, limit) {
  const dates = Array.from({ length: days }, (_, index) => addDays(startDate, -index));
  const rows = [];

  for (const date of dates) {
    const pageUrls = await discoverTdnetPageUrls(date);
    const pageBodies = await Promise.all(pageUrls.map((pageUrl) => fetchText(pageUrl)));
    for (const body of pageBodies) {
      rows.push(...parseTdnetHtml(body, date));
      if (rows.length >= limit) break;
    }
    if (rows.length >= limit) break;
  }

  return rows
    .sort((a, b) => b.datetime.localeCompare(a.datetime))
    .slice(0, limit);
}

async function discoverTdnetPageUrls(date) {
  const firstUrl = tdnetPageUrl(date, 1);
  const html = await fetchText(firstUrl);
  const pageNumbers = new Set([1]);
  const pagePattern = new RegExp(`I_list_(\\d{3})_${compactDate(date)}\\.html`, "g");
  for (const match of html.matchAll(pagePattern)) {
    pageNumbers.add(Number(match[1]));
  }

  return [...pageNumbers]
    .filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber >= 1)
    .sort((a, b) => a - b)
    .slice(0, MAX_TDNET_PAGES)
    .map((pageNumber) => tdnetPageUrl(date, pageNumber));
}

function tdnetPageUrl(date, pageNumber) {
  return `${TDNET_BASE_URL}/I_list_${String(pageNumber).padStart(3, "0")}_${compactDate(date)}.html`;
}

async function fetchJquantsDisclosures(env, date, days, limit) {
  const rows = [];
  for (let index = 0; index < days; index += 1) {
    const targetDate = addDays(date, -index);
    const payload = await fetchJquants(env, "/v2/td/list", { date: targetDate });
    rows.push(...(payload.data || []).map((item) => normalizeJquantsDisclosure(item)));
    if (rows.length >= limit) break;
  }

  return rows
    .sort((a, b) => b.datetime.localeCompare(a.datetime))
    .slice(0, limit);
}

async function fetchJquantsTradingCalendar(env, from, to) {
  const payload = await fetchJquants(env, "/v2/markets/calendar", { from, to });
  return (payload.data || [])
    .filter((item) => String(item.HolidayDivision ?? item.HolDiv ?? item.hol_div) !== "1")
    .map((item) => {
      const date = String(item.Date || item.date);
      return {
        id: `jquants-market-${date}`,
        date,
        title: holidayDivisionTitle(item),
        type: "holiday",
        market: "J-Quants",
        codes: [],
      };
    });
}

async function fetchJquantsEarningsCalendar(env, from, to) {
  const payload = await fetchJquants(env, "/v2/equities/earnings-calendar", { from, to });
  return (payload.data || []).map((item, index) => {
    const date = String(item.Date || item.AnnouncementDate || item.DisclosureDate || item.date || from);
    const code = normalizeSecurityCode(item.Code || item.LocalCode || item.code || "");
    const name = String(item.CompanyName || item.Name || item.company || "");
    return {
      id: `jquants-earnings-${date}-${code || index}`,
      date,
      title: `${code ? `${code} ` : ""}${name || "決算発表予定"}`,
      type: "earnings",
      market: "J-Quants",
      codes: code ? [code] : [],
    };
  });
}

async function fetchJquants(env, path, params) {
  const url = new URL(path, JQUANTS_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-api-key": env.JQUANTS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`J-Quants API error: ${response.status}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "MarketLensJP/0.2 (+https://github.com/)",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return "";
    throw new Error(`TDnet public page error: ${response.status}`);
  }

  return new TextDecoder("utf-8").decode(await response.arrayBuffer());
}

export function parseTdnetHtml(html, date) {
  if (!html) return [];

  const rowPattern =
    /<tr>\s*<td[^>]*class="[^"]*kjTime[^"]*"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*class="[^"]*kjCode[^"]*"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*class="[^"]*kjName[^"]*"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*class="[^"]*kjTitle[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
  const rows = [];

  for (const match of html.matchAll(rowPattern)) {
    const time = cleanCell(match[1]);
    const code = normalizeSecurityCode(cleanCell(match[2]));
    const company = cleanCell(match[3]);
    const titleCell = match[4];
    const linkMatch = titleCell.match(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const title = cleanCell(linkMatch?.[2] || titleCell);
    const href = linkMatch?.[1] || "";
    const category = categorizeTitle(title);

    if (!time || !title) continue;

    rows.push({
      id: `tdnet-${date}-${time.replace(":", "")}-${code}-${hashText(title)}`,
      code,
      company,
      datetime: `${date}T${time}:00+09:00`,
      title,
      category,
      priority: priorityForTitle(title, category),
      tone: "neutral",
      metrics: {
        impact: impactForCategory(category),
        speed: "公開",
        confidence: "一次情報",
      },
      summary: summaryForTitle(title, category),
      tags: ["TDnet", category],
      url: absoluteTdnetUrl(href),
      source: "tdnet-public",
    });
  }

  return rows;
}

function normalizeJquantsDisclosure(item) {
  const date = String(item.DiscDate || item.date || tokyoToday()).slice(0, 10);
  const time = String(item.DiscTime || item.time || "00:00").slice(0, 5);
  const title = String(item.Title || item.title || "タイトル未設定");
  const category = categorizeTitle(title);
  const code = normalizeSecurityCode(item.Code || item.code || "");
  const discNo = String(item.DiscNo || item.discNo || `${date}-${time}-${code}`);

  return {
    id: `jquants-${discNo}`,
    code,
    company: String(item.Name || item.CompanyName || item.company || "名称未設定"),
    datetime: `${date}T${time}:00+09:00`,
    title,
    category,
    priority: priorityForTitle(title, category),
    tone: "neutral",
    metrics: {
      impact: impactForCategory(category),
      speed: "API",
      confidence: "一次情報",
    },
    summary: summaryForTitle(title, category),
    tags: ["J-Quants", category],
    url: item.URL || item.url || "https://www.release.tdnet.info/",
    source: "jquants-tdnet",
  };
}

function cleanCell(value) {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeSecurityCode(value) {
  const raw = String(value).trim().toUpperCase();
  if (/^[0-9A-Z]{5}$/.test(raw) && raw.endsWith("0")) {
    return raw.slice(0, 4);
  }
  return raw;
}

function categorizeTitle(title) {
  if (/決算短信|四半期決算|決算説明|決算補足|月次業績/i.test(title)) return "決算";
  if (/業績予想|通期予想|予想の修正|業績修正|差異/i.test(title)) return "業績修正";
  if (/配当|剰余金|分配金/i.test(title)) return "配当";
  if (/自己株式|新株式|株式分割|株式併合|譲渡制限付株式|第三者割当/i.test(title)) return "資本政策";
  if (/公開買付|TOB|買収|合併|会社分割|株式譲渡|子会社の異動|事業譲渡/i.test(title)) return "M&A";
  if (/代表取締役|役員|人事異動/i.test(title)) return "人事";
  return "その他";
}

function priorityForTitle(title, category) {
  if (/公開買付|TOB|業績予想|予想の修正|自己株式|子会社の異動|合併|買収|不適切会計|特別損失/i.test(title)) {
    return "high";
  }
  if (["決算", "配当", "M&A", "資本政策"].includes(category)) return "medium";
  return "low";
}

function impactForCategory(category) {
  if (["業績修正", "M&A", "資本政策"].includes(category)) return "高";
  if (["決算", "配当"].includes(category)) return "中";
  return "低";
}

function summaryForTitle(title, category) {
  const common = "PDF本文で数値、対象期間、効力発生日、会社側の理由を確認してください。";
  if (category === "決算") {
    return ["売上高、営業利益、通期見通し、セグメント別の変化を確認します。", common];
  }
  if (category === "業績修正") {
    return ["修正前後の差分、要因、配当予想への波及を優先して確認します。", common];
  }
  if (category === "配当") {
    return ["1株当たり配当、基準日、配当性向、前回予想との差分を確認します。", common];
  }
  if (category === "資本政策") {
    return ["取得上限、希薄化、発行済株式数に対する割合、実施期間を確認します。", common];
  }
  if (category === "M&A") {
    return ["対象会社、取引価額、損益影響、クロージング条件を確認します。", common];
  }
  return [common, `分類: ${category} / タイトル: ${title}`];
}

function absoluteTdnetUrl(href) {
  if (!href) return "https://www.release.tdnet.info/";
  return new URL(href, `${TDNET_BASE_URL}/`).toString();
}

function marketHolidayEvents(from, to) {
  return JPX_HOLIDAYS_2026.filter(([date]) => date >= from && date <= to).map(([date, name]) => ({
    id: `jpx-holiday-${date}`,
    date,
    title: `市場休日: ${name}`,
    type: "holiday",
    market: "JPX",
    codes: [],
  }));
}

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.date}:${event.title}:${event.market}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function holidayDivisionTitle(item) {
  const value = String(item.HolidayDivision ?? item.HolDiv ?? item.hol_div ?? "");
  if (value === "0") return "市場休日";
  if (value === "2") return "半日立会日";
  if (value === "3") return "祝日取引日";
  return "取引カレンダー注意日";
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}

function errorResponse(message, status) {
  return jsonResponse({ ok: false, error: message }, status);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "";
}

function tokyoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(isoDate, amount) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function compactDate(date) {
  return date.replaceAll("-", "");
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function hashText(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
