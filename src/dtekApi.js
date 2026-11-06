const SHUTDOWNS_URL = process.env.DTEK_URL || "https://www.dtek-krem.com.ua/ua/shutdowns";
const RETRIES_MAX_COUNT = 2;
const RETRIES_TIMEOUT = 4000;

export class DtekBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "DtekBlockedError";
  }
}

class SimpleCookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setCookie(cookie, url, callback) {
    const [pair] = String(cookie).split(";");
    const index = pair.indexOf("=");
    if (index > 0) {
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (name) this.cookies.set(name, value);
    }
    if (typeof callback === "function") callback(null);
    return Promise.resolve();
  }

  getCookieString() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

let httpClientPromise = null;
let browserPromise = null;

function isBrowserFallbackEnabled() {
  return process.env.DTEK_BROWSER_FALLBACK !== "false";
}

async function getHttpClient() {
  if (!httpClientPromise) {
    httpClientPromise = (async () => {
      const { Impit } = await import("impit");
      return new Impit({
        browser: "chrome",
        followRedirects: true,
        timeout: 30000,
        cookieJar: new SimpleCookieJar(),
      });
    })().catch((error) => {
      httpClientPromise = null;
      throw new Error(`HTTP-клієнт недоступний: ${error.message}`);
    });
  }
  return httpClientPromise;
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright");
      return chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    })().catch((error) => {
      browserPromise = null;
      throw new Error(`Playwright недоступний: ${error.message}`);
    });
  }
  return browserPromise;
}

export async function closeDtekResources() {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  if (browser) {
    await browser.close().catch(() => {});
  }
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’'`ʼ]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(value) {
  return normalize(value)
    .replace(/^(м\.|м\s+|місто\s+|с-ще\s*|с\.\s*|смт\s*|селище\s+|сел\.\s*)/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value) {
  return clean(value).replace(/[^0-9a-zа-яіїєґ]/gi, "");
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
}

function extractJsonAssignment(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;

  const start = html.indexOf("{", markerIndex);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractMeta(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const nameMatch = tag.match(/\bname=["']([^"']+)["']/i);
    if (!nameMatch || nameMatch[1].toLowerCase() !== name.toLowerCase()) continue;
    const contentMatch = tag.match(/\bcontent=["']([^"']*)["']/i);
    return contentMatch ? contentMatch[1] : "";
  }
  return "";
}

function extractAlertMessage(html) {
  const match = html.match(
    /<div[^>]*class=["'][^"']*m-attention__text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  );
  if (!match) return null;

  const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 10 ? text : null;
}

function isBlockPage(html) {
  const sample = String(html || "").slice(0, 4000);
  return (
    /incapsula/i.test(sample) ||
    /Request unsuccessful/i.test(sample) ||
    /ROBOTS["']?\s+CONTENT=["']?NOINDEX/i.test(sample)
  );
}

export function parseDtekPage(html) {
  const fact = extractJsonAssignment(html, "DisconSchedule.fact");
  const preset = extractJsonAssignment(html, "DisconSchedule.preset");
  const streets = extractJsonAssignment(html, "DisconSchedule.streets") || {};

  return {
    fact,
    preset,
    streets,
    alertMessage: extractAlertMessage(html),
    csrfToken: extractMeta(html, "csrf-token"),
    csrfParam: extractMeta(html, "csrf-param") || "_csrf",
    ajaxUrl: extractMeta(html, "ajaxUrl") || "/ua/ajax",
  };
}

function buildFormBody(parsed, data) {
  const body = new URLSearchParams();
  if (parsed.csrfToken) body.append(parsed.csrfParam, parsed.csrfToken);
  for (const [key, value] of Object.entries(data)) {
    body.append(key, String(value));
  }
  return body.toString();
}

function resolveAjaxUrl(parsed) {
  return new URL(parsed.ajaxUrl || "/ua/ajax", SHUTDOWNS_URL).href;
}

function matchCity(streets, city) {
  const cityKeys = Object.keys(streets || {});
  return (
    cityKeys.find((key) => normalize(key) === normalize(city)) ||
    cityKeys.find((key) => clean(key) === clean(city)) ||
    cityKeys.find((key) => clean(key).includes(clean(city)) || clean(city).includes(clean(key))) ||
    null
  );
}

function matchStreet(streetList, street) {
  if (!Array.isArray(streetList)) return null;
  return (
    streetList.find((item) => normalize(item) === normalize(street)) ||
    streetList.find((item) => clean(item) === clean(street)) ||
    streetList.find((item) => clean(item).includes(clean(street)) || clean(street).includes(clean(item))) ||
    null
  );
}

function matchHouse(houseKeys, house) {
  return (
    houseKeys.find((key) => normalize(key) === normalize(house)) ||
    houseKeys.find((key) => compact(key) === compact(house)) ||
    houseKeys.find((key) => compact(key).startsWith(compact(house))) ||
    null
  );
}

export async function resolveHouse({ parsed, target, post }) {
  let streets = parsed.streets || {};
  if (!Object.keys(streets).length) {
    const streetsResponse = await post({ method: "getStreets" });
    if (streetsResponse.data?.streets) streets = streetsResponse.data.streets;
  }

  const cityKey = matchCity(streets, target.city);
  if (!cityKey) {
    throw new Error(`Населений пункт «${target.city}» не знайдено на сайті ДТЕК.`);
  }

  const streetValue = matchStreet(streets[cityKey], target.street);
  if (!streetValue) {
    throw new Error(`Вулицю «${target.street}» не знайдено для «${cityKey}».`);
  }

  const homeResponse = await post({
    method: "getHomeNum",
    "data[0][name]": "city",
    "data[0][value]": cityKey,
    "data[1][name]": "street",
    "data[1][value]": streetValue,
    "data[2][name]": "house_num",
    "data[2][value]": target.house,
  });

  if (!homeResponse.data) {
    throw new Error(`Сайт ДТЕК повернув некоректну відповідь (HTTP ${homeResponse.status}).`);
  }

  const homeRes = homeResponse.data;
  if (!homeRes?.result) {
    throw new Error("ДТЕК не повернув дані для цієї адреси.");
  }

  const houses = homeRes.data || {};
  const houseKeys = Object.keys(houses);
  const houseKey = matchHouse(houseKeys, target.house);

  if (!houseKey) {
    const sample = houseKeys.slice(0, 12).join(", ");
    throw new Error(
      `Будинок «${target.house}» не знайдено. Доступні варіанти: ${sample}${houseKeys.length > 12 ? "…" : ""}.`
    );
  }

  const info = houses[houseKey] || {};
  const rawGroups = Array.isArray(info.sub_type_reason)
    ? info.sub_type_reason
    : info.sub_type_reason
      ? [info.sub_type_reason]
      : [];
  const groups = rawGroups.map((group) => String(group).trim()).filter(Boolean);

  if (!groups.length) {
    throw new Error(
      "ДТЕК не визначив чергу відключень для цього будинку. Можливо, будинок має складну схему підключення."
    );
  }

  const currentOutage =
    homeRes.showCurOutageParam && info.sub_type
      ? { reason: info.sub_type, start: info.start_date || null, end: info.end_date || null }
      : null;

  return {
    fact: parsed.fact,
    preset: parsed.preset,
    groups,
    alertMessage: parsed.alertMessage,
    currentOutage,
    matched: {
      city: cityKey,
      street: streetValue,
      house: houseKey,
    },
    update: parsed.fact?.update || null,
  };
}

async function postViaHttp(client, parsed, data) {
  const response = await client.fetch(resolveAjaxUrl(parsed), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRF-Token": parsed.csrfToken || "",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: SHUTDOWNS_URL,
      Origin: new URL(SHUTDOWNS_URL).origin,
    },
    body: buildFormBody(parsed, data),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    if (isBlockPage(text)) {
      throw new DtekBlockedError("Сайт ДТЕК тимчасово блокує запити (Incapsula).");
    }
    throw new Error(`Сайт ДТЕК повернув некоректну відповідь (HTTP ${response.status}).`);
  }

  return { status: response.status, data: json };
}

async function postViaPage(page, parsed, data) {
  return page.evaluate(
    async ({ url, body, csrfToken }) => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-Token": csrfToken || "",
        },
        body,
      });
      let json = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }
      return { status: response.status, data: json };
    },
    { url: resolveAjaxUrl(parsed), body: buildFormBody(parsed, data), csrfToken: parsed.csrfToken || "" }
  );
}

async function fetchScheduleViaHttp(target) {
  const client = await getHttpClient();
  const response = await client.fetch(SHUTDOWNS_URL, {
    headers: {
      "Accept-Language": "uk-UA,uk;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const html = await response.text();
  if (!html.includes("DisconSchedule.fact")) {
    if (isBlockPage(html) || html.length < 2000) {
      throw new DtekBlockedError("Сайт ДТЕК тимчасово блокує HTTP-запити (Incapsula).");
    }
    throw new Error("Сторінка ДТЕК не містить графіка відключень.");
  }

  const parsed = parseDtekPage(html);
  if (!parsed.fact) {
    throw new Error("Не вдалося розібрати графік відключень зі сторінки ДТЕК.");
  }

  const resolved = await resolveHouse({
    parsed,
    target,
    post: (data) => postViaHttp(client, parsed, data),
  });

  return { ...resolved, source: "http" };
}

async function fetchScheduleViaBrowser(target) {
  if (!isBrowserFallbackEnabled()) {
    throw new Error("Резервний браузер вимкнено (DTEK_BROWSER_FALLBACK=false).");
  }

  const browser = await getBrowser();
  const page = await browser.newPage({ locale: "uk-UA", viewport: { width: 1280, height: 800 } });

  try {
    await page.goto(SHUTDOWNS_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page
      .waitForFunction(() => typeof DisconSchedule !== "undefined" && !!DisconSchedule.fact, null, {
        timeout: 30000,
      })
      .catch(() => {});

    const html = await page.content();
    const parsed = parseDtekPage(html);

    if (!parsed.fact) {
      const evaluateValue = async (key) =>
        page.evaluate((name) => {
          try {
            return typeof DisconSchedule !== "undefined" ? DisconSchedule[name] : null;
          } catch {
            return null;
          }
        }, key);

      parsed.fact = await evaluateValue("fact");
      if (!parsed.preset) parsed.preset = await evaluateValue("preset");
      if (!Object.keys(parsed.streets || {}).length) {
        parsed.streets = (await evaluateValue("streets")) || {};
      }
      if (!parsed.alertMessage) {
        parsed.alertMessage = await page
          .evaluate(() => {
            const element =
              document.querySelector("#modal-attention .m-attention__text") ||
              document.querySelector("#modal-attention");
            if (!element) return null;
            const text = (element.innerText || "").replace(/\s+/g, " ").trim();
            return text.length > 10 ? text : null;
          })
          .catch(() => null);
      }
    }

    if (!parsed.fact) {
      if (isBlockPage(html)) {
        throw new DtekBlockedError("Сайт ДТЕК блокує навіть браузер (Incapsula).");
      }
      throw new Error("Не вдалося отримати графік відключень зі сторінки ДТЕК.");
    }

    const resolved = await resolveHouse({
      parsed,
      target,
      post: (data) => postViaPage(page, parsed, data),
    });

    return { ...resolved, source: "browser" };
  } finally {
    await page.close().catch(() => {});
  }
}

export async function getAddressSchedule(target) {
  const errors = [];

  for (let attempt = 1; attempt <= RETRIES_MAX_COUNT; attempt++) {
    try {
      console.log(`🌐 [${target.name}] Запитую ДТЕК через HTTP (спроба ${attempt}/${RETRIES_MAX_COUNT})...`);
      const result = await fetchScheduleViaHttp(target);
      console.log(`✅ [${target.name}] Дані отримано через HTTP, без браузера.`);
      return result;
    } catch (error) {
      errors.push(`HTTP: ${error.message}`);
      if (error instanceof DtekBlockedError) break;
      console.warn(`⚠️ [${target.name}] HTTP не спрацював: ${error.message}`);
      if (attempt < RETRIES_MAX_COUNT) {
        await new Promise((resolve) => setTimeout(resolve, RETRIES_TIMEOUT));
      }
    }
  }

  if (isBrowserFallbackEnabled()) {
    for (let attempt = 1; attempt <= RETRIES_MAX_COUNT; attempt++) {
      try {
        console.log(`🧭 [${target.name}] Пробую резервний Playwright (спроба ${attempt}/${RETRIES_MAX_COUNT})...`);
        const result = await fetchScheduleViaBrowser(target);
        console.log(`✅ [${target.name}] Дані отримано через Playwright.`);
        return result;
      } catch (error) {
        errors.push(`Браузер: ${error.message}`);
        console.warn(`⚠️ [${target.name}] Playwright не спрацював: ${error.message}`);
        if (attempt < RETRIES_MAX_COUNT) {
          await new Promise((resolve) => setTimeout(resolve, RETRIES_TIMEOUT));
        }
      }
    }
  } else {
    errors.push("Браузер: резервний Playwright вимкнено (DTEK_BROWSER_FALLBACK=false).");
  }

  throw new Error(
    `Не вдалося отримати графік для «${target.name}». ${errors.join(" | ")}`
  );
}
