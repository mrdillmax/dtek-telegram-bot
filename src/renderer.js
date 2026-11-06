import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, "..", "assets");
const KYIV_TZ = "Europe/Kyiv";

const WIDTH = 900;
const OUTER = 24;
const CARD_X = OUTER;
const CARD_W = WIDTH - OUTER * 2;
const CARD_RADIUS = 22;
const PAD = 28;
const X = CARD_X + PAD;
const CW = CARD_W - PAD * 2;
const TOP = OUTER;
const ACCENT_H = 8;

const COLORS = {
  page: "#F2F2F2",
  card: "#FFFFFF",
  border: "#E4E5E6",
  navy: "#11203E",
  grey: "#5A636B",
  lightGrey: "#F7F7F8",
  midGrey: "#D3D4D5",
  paleGrey: "#EEEFEF",
  cellBorder: "#D9DADB",
  yellow: "#FFE500",
  paleYellow: "#FFF9C4",
  alertBg: "#FFFDE6",
  alertBorder: "#FFE500",
  red: "#D92D20",
  redBg: "#FFF4F4",
  redBorder: "#F3C6C6",
  green: "#1D7A34",
  greenBg: "#E8F7E7",
  amber: "#8A6D00",
  amberBg: "#FFF7B8",
};

const BOLT_ON = "M11.9039 8.49553L4.42571 1.18281L3.74875 4.46782L3.01699 7.86709C2.99853 7.95225 2.99999 8.0409 3.02123 8.12621C3.04248 8.21151 3.08296 8.29119 3.13954 8.3591C3.19612 8.427 3.26729 8.48131 3.34756 8.51785C3.42784 8.55438 3.51506 8.57215 3.60252 8.5698H6.36252L5.45266 15.3398C5.4363 15.4653 5.46232 15.5935 5.52663 15.7042C5.59093 15.8149 5.68985 15.9017 5.80778 15.9511C5.88101 15.9806 5.95887 15.9961 6.03727 15.9968C6.12453 15.9966 6.21019 15.9764 6.28766 15.9378C6.36514 15.8991 6.43238 15.8431 6.48423 15.774L10.2013 10.7865L11.9039 8.49553ZM11.9039 8.49553L13.7179 6.06176C13.7763 5.98058 13.8118 5.88494 13.8209 5.78459C13.8299 5.68423 13.8121 5.58275 13.7693 5.49046C13.7243 5.38896 13.6511 5.30206 13.5586 5.24023C13.4662 5.17839 13.3583 5.14427 13.248 5.14196L10.5337 5.14196L11.4445 0.697198C11.4618 0.612884 11.4596 0.525376 11.4381 0.441262C11.4166 0.357148 11.3764 0.27862 11.3205 0.211587C11.2642 0.143778 11.1933 0.089467 11.1133 0.0528239C11.0333 0.0161808 10.9464 -0.00181983 10.8591 0.000204192L5.14484 0.000204192C5.01346 -0.00330556 4.88579 0.0385213 4.78332 0.118644C4.68085 0.198766 4.60984 0.312292 4.58224 0.44011L4.42571 1.18281L11.9039 8.49553Z";
const BOLT_OFF = "M15.875 15.0818L0.918125 0.124957L0.125 0.918082L3.725 4.52371L2.9375 7.87058C2.91765 7.95443 2.91733 8.04171 2.93656 8.1257C2.95579 8.20969 2.99406 8.28815 3.04842 8.355C3.10277 8.42186 3.17176 8.47533 3.25006 8.5113C3.32835 8.54727 3.41387 8.56477 3.5 8.56246H6.21688L5.1875 15.2281C5.16892 15.3516 5.19201 15.4779 5.25312 15.5868C5.31423 15.6958 5.40989 15.7814 5.525 15.83C5.5965 15.859 5.67284 15.8742 5.75 15.875C5.8359 15.8747 5.92062 15.8549 5.99765 15.8168C6.07468 15.7788 6.14197 15.7237 6.19438 15.6556L9.95187 10.745L15.0819 15.875L15.875 15.0818ZM11.6731 8.48933L13.5069 6.09308C13.566 6.01315 13.6028 5.91899 13.6137 5.82018C13.6246 5.72137 13.6091 5.62145 13.5687 5.53058C13.5265 5.43065 13.4562 5.34509 13.3663 5.28421C13.2765 5.22333 13.171 5.18973 13.0625 5.18746H10.3906L11.375 0.811207C11.3936 0.728192 11.3932 0.642033 11.3737 0.559216C11.3542 0.476399 11.3162 0.399081 11.2625 0.333082C11.2084 0.266318 11.1397 0.212844 11.0617 0.176766C10.9837 0.140687 10.8984 0.122964 10.8125 0.124957H5.1875C5.05824 0.121501 4.93174 0.162683 4.82929 0.241571C4.72684 0.320458 4.65469 0.432234 4.625 0.558082L4.45625 1.28933L11.6731 8.48933Z";

const VALID_STATES = new Set(["yes", "no", "maybe", "first", "second", "mfirst", "msecond"]);

function getKyivNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KYIV_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

function dateKeyToIsoDate(unixSeconds) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KYIV_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(unixSeconds * 1000));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDaysToIsoDate(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function safeDateFromKey(key) {
  const num = Number(key);
  if (!Number.isFinite(num) || num <= 0) return null;
  return dateKeyToIsoDate(num);
}

function buildDateIndex(fact) {
  const index = new Map();
  for (const key of Object.keys(fact?.data || {})) {
    const iso = safeDateFromKey(key);
    if (iso) index.set(iso, key);
  }
  return index;
}

function computeOutageIntervals(hours) {
  if (!hours) return { off: [], maybe: [] };

  const segments = [];
  for (let h = 0; h < 24; h++) {
    const state = hours[h + 1];
    const start = h * 60;
    switch (state) {
      case "no":
        segments.push({ from: start, to: start + 60, kind: "off" });
        break;
      case "first":
        segments.push({ from: start, to: start + 30, kind: "off" });
        break;
      case "second":
        segments.push({ from: start + 30, to: start + 60, kind: "off" });
        break;
      case "maybe":
        segments.push({ from: start, to: start + 60, kind: "maybe" });
        break;
      case "mfirst":
        segments.push({ from: start, to: start + 30, kind: "maybe" });
        break;
      case "msecond":
        segments.push({ from: start + 30, to: start + 60, kind: "maybe" });
        break;
      default:
        break;
    }
  }

  const merge = (kind) => {
    const result = [];
    for (const seg of segments.filter((s) => s.kind === kind).sort((a, b) => a.from - b.from)) {
      const last = result[result.length - 1];
      if (last && seg.from <= last.to) {
        last.to = Math.max(last.to, seg.to);
      } else {
        result.push({ ...seg });
      }
    }
    return result;
  };

  return { off: merge("off"), maybe: merge("maybe") };
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatIntervals(intervals) {
  return intervals.map((i) => `${minutesToTime(i.from)}–${minutesToTime(i.to)}`).join(", ");
}

function resolveCurrentStatus(hours, now) {
  if (!hours) return { cls: "unknown", text: "Дані відсутні" };
  const state = hours[now.hour + 1];
  if (!state) return { cls: "unknown", text: "Дані відсутні" };

  const firstHalf = now.minute < 30;
  switch (state) {
    case "yes":
      return { cls: "on", text: "Світло є" };
    case "no":
      return { cls: "off", text: "Світла немає" };
    case "first":
      return firstHalf ? { cls: "off", text: "Світла немає" } : { cls: "on", text: "Світло є" };
    case "second":
      return firstHalf ? { cls: "on", text: "Світло є" } : { cls: "off", text: "Світла немає" };
    case "maybe":
    case "mfirst":
    case "msecond":
      return { cls: "maybe", text: "Можливо відключення" };
    default:
      return { cls: "unknown", text: "Дані відсутні" };
  }
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textWidth(text, fontSize, weight = 400) {
  const factor = weight >= 700 ? 0.605 : weight >= 500 ? 0.575 : 0.545;
  return String(text ?? "").length * fontSize * factor;
}

function wrapText(text, maxWidth, fontSize, weight = 400) {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, fontSize, weight) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (textWidth(word, fontSize, weight) <= maxWidth) {
      current = word;
    } else {
      let rest = word;
      while (rest) {
        let cut = rest.length;
        while (cut > 1 && textWidth(rest.slice(0, cut), fontSize, weight) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = "";
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textBlock(lines, x, y, lineHeight, attrs) {
  return lines
    .map((line, i) => `<text x="${x}" y="${y + i * lineHeight}" ${attrs}>${escapeXml(line)}</text>`)
    .join("");
}

function textEl(x, y, content, { size = 14, weight = 400, fill = COLORS.navy, anchor = "start", opacity } = {}) {
  const op = opacity != null ? ` opacity="${opacity}"` : "";
  return `<text x="${x}" y="${y}" font-family="Roboto, 'DejaVu Sans', sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${op}>${escapeXml(content)}</text>`;
}

function rectEl(x, y, w, h, { rx = 0, fill = "none", stroke = "none", sw = 1, opacity } = {}) {
  const op = opacity != null ? ` opacity="${opacity}"` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${op}/>`;
}

function boltUse(kind, cx, cy, size) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  return `<use href="#bolt-${kind}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
}

function roundedHalfPath(x, y, w, h, r, position) {
  const half = h / 2;
  if (position === "top") {
    return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + half} H ${x} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
  }
  return `M ${x} ${y + half} H ${x + w} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} Z`;
}

function cellSvg(state, x, y, w, h, isNow) {
  const parts = [];
  const radius = 4;

  const drawFull = (fill, stroke, iconKind) => {
    parts.push(rectEl(x, y, w, h, { rx: radius, fill, stroke, sw: 1 }));
    if (iconKind) parts.push(boltUse(iconKind, x + w / 2, y + h / 2, Math.min(12, h - 12)));
  };

  switch (state) {
    case "no":
      drawFull(COLORS.midGrey, "#C5C6C7", "off");
      break;
    case "maybe":
      drawFull(COLORS.paleGrey, COLORS.cellBorder, "maybe");
      break;
    case "first":
    case "second":
    case "mfirst":
    case "msecond": {
      const first = state === "first" || state === "mfirst";
      const maybe = state === "mfirst" || state === "msecond";
      const fill = maybe ? COLORS.paleGrey : COLORS.midGrey;
      const icon = maybe ? "maybe" : "off";
      parts.push(rectEl(x, y, w, h, { rx: radius, fill: "#FFFFFF", stroke: COLORS.cellBorder, sw: 1 }));
      parts.push(`<path d="${roundedHalfPath(x, y, w, h, radius, first ? "top" : "bottom")}" fill="${fill}"/>`);
      const topKind = first ? icon : "on";
      const bottomKind = first ? "on" : icon;
      parts.push(boltUse(topKind, x + w / 2, y + h * 0.26, Math.min(8.5, h * 0.24)));
      parts.push(boltUse(bottomKind, x + w / 2, y + h * 0.74, Math.min(8.5, h * 0.24)));
      break;
    }
    case "yes":
      drawFull("#FFFFFF", COLORS.cellBorder, "on");
      break;
    default:
      parts.push(rectEl(x, y, w, h, { rx: radius, fill: "#FFFFFF", stroke: COLORS.cellBorder, sw: 1 }));
      parts.push(textEl(x + w / 2, y + h / 2 + 4, "?", { size: 11, weight: 500, fill: "#9FA0A2", anchor: "middle" }));
      break;
  }

  if (isNow) {
    parts.push(rectEl(x - 1, y - 1, w + 2, h + 2, { rx: radius + 1, fill: "none", stroke: COLORS.yellow, sw: 2 }));
  }

  return parts.join("");
}

function buildScheduleTable({ groups, dayData, preset, now, isToday }) {
  const parts = [];
  const rowH = 36;
  const gap = 3;
  const labelW = 66;
  const pad = 10;
  const innerW = CW - pad * 2;
  const cellW = (innerW - labelW - gap * 23) / 24;
  const headerH = 17;
  const rows = Math.max(groups.length, 1);
  const tableH = pad * 2 + headerH + rows * rowH + (rows - 1) * gap;
  const tableY = 0;

  const items = [];

  items.push(rectEl(X, tableY, CW, tableH, { rx: 12, fill: COLORS.lightGrey, stroke: COLORS.border, sw: 1 }));

  const gridX = X + pad;
  const cellsX = gridX + labelW + gap;
  const headerY = tableY + pad + 11;

  for (let h = 0; h < 24; h++) {
    const label = String(h).padStart(2, "0");
    const cx = cellsX + h * (cellW + gap) + cellW / 2;
    items.push(textEl(cx, headerY, label, { size: 8.5, weight: 500, fill: "#8A9099", anchor: "middle" }));
  }

  groups.forEach((group, index) => {
    const rowY = tableY + pad + headerH + index * (rowH + gap);
    const groupName = preset?.sch_names?.[group] || group;
    const shortName = groupName.replace(/^Черга\s*/i, "").trim() || groupName;
    const label = groups.length > 1 ? `Лінія ${index + 1}` : "Черга";
    const label2 = groups.length > 1 ? "" : shortName;
    items.push(textEl(gridX + labelW / 2, rowY + (label2 ? rowH / 2 - 2 : rowH / 2 + 4), label, {
      size: groups.length > 1 ? 9.5 : 9,
      weight: 500,
      fill: COLORS.grey,
      anchor: "middle",
    }));
    if (label2) {
      items.push(textEl(gridX + labelW / 2, rowY + rowH / 2 + 13, label2, {
        size: 12,
        weight: 700,
        fill: COLORS.navy,
        anchor: "middle",
      }));
    }

    const hours = dayData?.[group] || null;
    for (let h = 0; h < 24; h++) {
      const state = hours?.[h + 1];
      const cx = cellsX + h * (cellW + gap);
      const isNow = Boolean(isToday && now.hour === h);
      items.push(cellSvg(VALID_STATES.has(state) ? state : "unknown", cx, rowY, cellW, rowH, isNow));
    }
  });

  parts.push(`<g>${items.join("")}</g>`);
  return { svg: parts.join(""), height: tableH };
}

function buildLegend(y) {
  const items = [
    { kind: "on", label: "Світло є" },
    { kind: "off", label: "Світла немає" },
    { kind: "maybe", label: "Можливо відключення" },
    { kind: "half", label: "Немає 30 хв" },
  ];
  const parts = [rectEl(X, y, CW, 1, { fill: "#EDEEEF" })];
  const itemW = CW / 4;
  const iconY = y + 25;
  items.forEach((item, i) => {
    const ix = X + i * itemW;
    if (item.kind === "half") {
      parts.push(rectEl(ix, iconY - 8, 16, 16, { rx: 3, fill: "#FFFFFF", stroke: COLORS.cellBorder }));
      parts.push(`<path d="${roundedHalfPath(ix, iconY - 8, 16, 16, 3, "top")}" fill="${COLORS.midGrey}"/>`);
    } else {
      const fill = item.kind === "on" ? "#FFFFFF" : item.kind === "off" ? COLORS.midGrey : COLORS.paleGrey;
      parts.push(rectEl(ix, iconY - 8, 16, 16, { rx: 3, fill, stroke: COLORS.cellBorder }));
      parts.push(boltUse(item.kind, ix + 8, iconY, 10));
    }
    parts.push(textEl(ix + 24, iconY + 4, item.label, { size: 11.5, weight: 400, fill: COLORS.grey }));
  });
  return { svg: parts.join(""), height: 44 };
}

function badgeStyle(cls) {
  switch (cls) {
    case "on":
      return { bg: COLORS.greenBg, fg: COLORS.green, dot: "#2FA84F" };
    case "off":
      return { bg: COLORS.navy, fg: "#FFFFFF", dot: COLORS.yellow };
    case "maybe":
      return { bg: COLORS.amberBg, fg: COLORS.amber, dot: "#D4A900" };
    default:
      return { bg: "#F1F1F2", fg: COLORS.grey, dot: "#9FA0A2" };
  }
}

function dayPill(label, date, active) {
  const text = `${label} ${formatDateShort(date)}`;
  const w = textWidth(text, 14, 500) + 28;
  const h = 34;
  return {
    width: w,
    svg: [
      rectEl(0, 0, w, h, { rx: 8, fill: active ? COLORS.yellow : COLORS.lightGrey, stroke: active ? COLORS.yellow : COLORS.border }),
      textEl(w / 2, 22, text, { size: 14, weight: 500, fill: COLORS.navy, anchor: "middle" }),
    ].join(""),
    height: h,
  };
}

function groupPill(label) {
  const w = textWidth(label, 12, 700) + 24;
  const h = 28;
  return {
    width: w,
    svg: [
      rectEl(0, 0, w, h, { rx: 7, fill: "#FFFFFF", stroke: COLORS.border }),
      textEl(w / 2, 19, label, { size: 12, weight: 700, fill: COLORS.navy, anchor: "middle" }),
    ].join(""),
    height: h,
  };
}

function noDataBox(text, y) {
  const lines = wrapText(text, CW - 70, 12.5, 400);
  const h = Math.max(64, 20 + lines.length * 18 + 16);
  const parts = [
    rectEl(X, y, CW, h, { rx: 12, fill: COLORS.lightGrey, stroke: "#D9DADB", sw: 1 }),
    `<circle cx="${X + 24}" cy="${y + 22}" r="9" fill="${COLORS.yellow}"/>`,
    textEl(X + 24, y + 27, "i", { size: 13, weight: 700, fill: COLORS.navy, anchor: "middle" }),
  ];
  parts.push(textBlock(lines, X + 44, y + 27, 18, `font-family="Roboto, 'DejaVu Sans', sans-serif" font-size="12.5" font-weight="400" fill="${COLORS.grey}"`));
  return { svg: parts.join(""), height: h };
}

function alertBanner(text, y) {
  const lines = wrapText(text, CW - 74, 12.5, 400);
  const h = 16 + 18 + lines.length * 17.5 + 14;
  const parts = [
    rectEl(X, y, CW, h, { rx: 12, fill: COLORS.alertBg, stroke: COLORS.alertBorder, sw: 1 }),
    `<circle cx="${X + 25}" cy="${y + 24}" r="9" fill="${COLORS.yellow}"/>`,
    textEl(X + 25, y + 29, "!", { size: 13, weight: 700, fill: COLORS.navy, anchor: "middle" }),
    textEl(X + 44, y + 24, "Повідомлення ДТЕК", { size: 12, weight: 700, fill: "#6B5A00" }),
  ];
  parts.push(textBlock(lines, X + 44, y + 42, 17.5, `font-family="Roboto, 'DejaVu Sans', sans-serif" font-size="12.5" font-weight="400" fill="#6B5A00"`));
  return { svg: parts.join(""), height: h };
}

function outageBanner(currentOutage, y) {
  const reason = currentOutage?.reason ? String(currentOutage.reason) : "";
  const end = currentOutage?.end || currentOutage?.end_date || null;
  const title = "За вашою адресою зараз відсутня електроенергія";
  const lines = wrapText(reason ? `Причина: ${reason}` : "", CW - 74, 12.5, 400);
  const endLine = end ? `Орієнтовний час відновлення: до ${end}` : "";
  const h = 16 + 19 + lines.length * 17 + (endLine ? 18 : 0) + 12;
  const parts = [
    rectEl(X, y, CW, h, { rx: 12, fill: COLORS.redBg, stroke: COLORS.redBorder, sw: 1 }),
    rectEl(X, y, 5, h, { rx: 2, fill: COLORS.red }),
    `<circle cx="${X + 27}" cy="${y + 24}" r="7" fill="${COLORS.red}"/>`,
    textEl(X + 44, y + 29, title, { size: 13, weight: 700, fill: "#8A1C14" }),
  ];
  let ty = y + 48;
  if (lines.length) {
    parts.push(textBlock(lines, X + 44, ty, 17, `font-family="Roboto, 'DejaVu Sans', sans-serif" font-size="12.5" font-weight="400" fill="#7A2A24"`));
    ty += lines.length * 17;
  }
  if (endLine) {
    parts.push(textEl(X + 44, ty, endLine, { size: 12.5, weight: 700, fill: "#8A1C14" }));
  }
  return { svg: parts.join(""), height: h };
}

function summaryLines({ groups, dayData, preset }) {
  const lines = [];
  const allOff = [];
  const allMaybe = [];
  for (const group of groups) {
    const hours = dayData?.[group];
    if (!hours) continue;
    const intervals = computeOutageIntervals(hours);
    const name = groups.length > 1 ? `${preset?.sch_names?.[group] || group}: ` : "";
    if (intervals.off.length) allOff.push(`${name}${formatIntervals(intervals.off)}`);
    if (intervals.maybe.length) allMaybe.push(`${name}${formatIntervals(intervals.maybe)}`);
  }
  if (allOff.length) lines.push({ kind: "off", text: `Відключення: ${allOff.join(" • ")}` });
  else lines.push({ kind: "on", text: "Відключень не передбачено" });
  if (allMaybe.length) lines.push({ kind: "maybe", text: `Можливо: ${allMaybe.join(" • ")}` });
  return lines;
}

function renderDaySection({ title, date, active, groups, dayData, preset, now, isToday, noDataText }) {
  const parts = [];
  let height = 0;

  const pill = dayPill(title, date, active);
  parts.push(`<g transform="translate(${X}, ${height})">${pill.svg}</g>`);

  const groupLabel = groups.length > 1
    ? `${groups.length} лінії`
    : (groups[0] ? preset?.sch_names?.[groups[0]] || groups[0] : "Черга не визначена");
  const gPill = groupPill(groupLabel);
  parts.push(`<g transform="translate(${X + CW - gPill.width}, ${height + 3})">${gPill.svg}</g>`);
  height += pill.height + 14;

  if (dayData) {
    const table = buildScheduleTable({ groups, dayData, preset, now, isToday });
    parts.push(`<g transform="translate(0, ${height})">${table.svg}</g>`);
    height += table.height + 12;

    const summary = summaryLines({ groups, dayData, preset });
    for (const line of summary) {
      const iconKind = line.kind === "off" ? "off" : line.kind === "maybe" ? "maybe" : "on";
      const weight = line.kind === "off" ? 500 : 400;
      const fill = line.kind === "off" ? COLORS.navy : COLORS.grey;
      const lines = wrapText(line.text, CW - 32, 12.5, weight);
      parts.push(boltUse(iconKind, X + 8, height + 7, 12));
      lines.forEach((text, i) => {
        parts.push(textEl(X + 20, height + 12 + i * 17, text, { size: 12.5, weight, fill }));
      });
      height += Math.max(20, lines.length * 17 + 3);
    }
  } else {
    const box = noDataBox(noDataText, 0);
    parts.push(`<g transform="translate(0, ${height})">${box.svg}</g>`);
    height += box.height;
  }

  return { svg: parts.join(""), height };
}

function renderStatusCardSvg(target, scheduleData, options = {}) {
  const now = options.now || getKyivNow();
  const fact = scheduleData?.fact || null;
  const preset = scheduleData?.preset || null;
  const groups = Array.isArray(scheduleData?.groups) ? scheduleData.groups.filter(Boolean) : [];
  const alertMessage = options.alertMessage ?? scheduleData?.alertMessage ?? null;
  const currentOutage = options.currentOutage ?? scheduleData?.currentOutage ?? null;

  const dateIndex = fact ? buildDateIndex(fact) : new Map();
  const todayIso = now.date;
  const tomorrowIso = addDaysToIsoDate(todayIso, 1);
  const todayKey = dateIndex.get(todayIso) || null;
  const tomorrowKey = dateIndex.get(tomorrowIso) || null;
  const todayData = todayKey && fact?.data?.[todayKey] ? fact.data[todayKey] : null;
  const tomorrowData = tomorrowKey && fact?.data?.[tomorrowKey] ? fact.data[tomorrowKey] : null;

  const currentStatus = resolveCurrentStatus(todayData && groups[0] ? todayData[groups[0]] : null, now);
  const status = badgeStyle(currentStatus.cls);

  const body = [];
  let y = TOP + ACCENT_H + 26;

  // Brand row
  const logoSvg = fs.readFileSync(path.join(ASSETS_DIR, "logo-dtek.svg"), "utf8");
  const logoW = 218;
  const logoH = (logoW / 294) * 30;
  const embeddedLogo = logoSvg.replace(
    /<svg[^>]*>/,
    `<svg x="${X}" y="${y}" width="${logoW}" height="${logoH}" viewBox="0 0 294 30" fill="none" xmlns="http://www.w3.org/2000/svg">`
  );
  body.push(embeddedLogo);

  const statusTextW = textWidth(currentStatus.text, 12.5, 700);
  const badgeW = statusTextW + 40;
  const badgeH = 30;
  body.push(`<g transform="translate(${X + CW - badgeW}, ${y - 2})">`);
  body.push(rectEl(0, 0, badgeW, badgeH, { rx: 15, fill: status.bg }));
  body.push(`<circle cx="16" cy="${badgeH / 2}" r="4" fill="${status.dot}"/>`);
  body.push(textEl(28, 20, currentStatus.text, { size: 12.5, weight: 700, fill: status.fg }));
  body.push(`</g>`);

  y += 34;

  // Address
  body.push(textEl(X, y + 22, target.name, { size: 27, weight: 700, fill: COLORS.navy }));
  y += 32;
  const details = `${target.city}, ${target.street}, буд. ${target.house}`;
  body.push(textEl(X, y + 14, details, { size: 14, weight: 400, fill: COLORS.grey }));
  y += 24;

  // Group chips
  const groupNames = groups.length
    ? groups.map((g) => preset?.sch_names?.[g] || g)
    : [];
  if (groupNames.length) {
    let chipX = X;
    groupNames.forEach((name, i) => {
      const label = groups.length > 1 ? `Лінія ${i + 1}: ${name}` : name;
      const chipW = textWidth(label, 12, 700) + 24;
      body.push(rectEl(chipX, y, chipW, 28, { rx: 7, fill: COLORS.yellow }));
      body.push(textEl(chipX + chipW / 2, y + 19, label, { size: 12, weight: 700, fill: COLORS.navy, anchor: "middle" }));
      chipX += chipW + 8;
    });
    y += 28;
  }
  y += 18;

  // Alerts
  if (alertMessage) {
    const banner = alertBanner(alertMessage, y);
    body.push(banner.svg);
    y += banner.height + 12;
  }
  if (currentOutage?.reason) {
    const banner = outageBanner(currentOutage, y);
    body.push(banner.svg);
    y += banner.height + 12;
  }

  y += 4;

  // Today
  const todaySection = renderDaySection({
    title: "на сьогодні",
    date: todayIso,
    active: true,
    groups,
    dayData: todayData,
    preset,
    now,
    isToday: true,
    noDataText: "Інформація від НЕК «Укренерго» про обмеження на цей день ще не надходила.",
  });
  body.push(`<g transform="translate(0, ${y})">${todaySection.svg}</g>`);
  y += todaySection.height + 22;

  // Tomorrow
  const tomorrowSection = renderDaySection({
    title: "на завтра",
    date: tomorrowIso,
    active: false,
    groups,
    dayData: tomorrowData,
    preset,
    now,
    isToday: false,
    noDataText: "Інформація від НЕК «Укренерго» про обмеження на наступний день ще не надходила.",
  });
  body.push(`<g transform="translate(0, ${y})">${tomorrowSection.svg}</g>`);
  y += tomorrowSection.height + 12;

  // Legend
  const legend = buildLegend(y);
  body.push(legend.svg);
  y += legend.height + 10;

  // Footer
  const footerY = y;
  const footerH = 46;
  const cardH = footerY + footerH - TOP;
  body.push(rectEl(CARD_X, footerY, CARD_W, footerH, { fill: COLORS.lightGrey }));
  body.push(rectEl(CARD_X, footerY, CARD_W, 1, { fill: "#EDEEEF" }));
  const updated = new Date().toLocaleString("uk-UA", { timeZone: KYIV_TZ });
  body.push(textEl(X, footerY + 28, `Оновлено: ${updated}`, { size: 11, weight: 400, fill: COLORS.grey }));
  body.push(textEl(X + CW, footerY + 28, "dtek-krem.com.ua", { size: 11, weight: 500, fill: COLORS.grey, anchor: "end" }));

  const totalH = cardH + OUTER * 2;
  const defs = `
    <defs>
      <symbol id="bolt-on" viewBox="0 0 16 16"><path d="${BOLT_ON}" fill="${COLORS.yellow}"/></symbol>
      <symbol id="bolt-off" viewBox="0 0 16 16"><path d="${BOLT_OFF}" fill="${COLORS.navy}"/></symbol>
      <symbol id="bolt-maybe" viewBox="0 0 16 16"><path d="${BOLT_OFF}" fill="#898E96"/></symbol>
      <clipPath id="card-clip"><rect x="${CARD_X}" y="${TOP}" width="${CARD_W}" height="${cardH}" rx="${CARD_RADIUS}"/></clipPath>
    </defs>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${totalH}" viewBox="0 0 ${WIDTH} ${totalH}">
  ${defs}
  <rect width="${WIDTH}" height="${totalH}" fill="${COLORS.page}"/>
  <g clip-path="url(#card-clip)">
    <rect x="${CARD_X}" y="${TOP}" width="${CARD_W}" height="${cardH}" fill="${COLORS.card}" stroke="${COLORS.border}"/>
    <rect x="${CARD_X}" y="${TOP}" width="${CARD_W}" height="${ACCENT_H}" fill="${COLORS.yellow}"/>
    ${body.join("\n    ")}
  </g>
</svg>`;
}

export async function renderStatusCard(target, scheduleData, options = {}) {
  const svg = renderStatusCardSvg(target, scheduleData, options);

  const fonts = ["Roboto-Regular.ttf", "Roboto-Medium.ttf", "Roboto-Bold.ttf"]
    .map((file) => path.join(ASSETS_DIR, "fonts", file))
    .filter((file) => fs.existsSync(file));

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: {
      loadSystemFonts: true,
      fontFiles: fonts,
      defaultFontFamily: "Roboto",
      sansSerifFamily: "Roboto",
    },
    background: COLORS.page,
  });
  const png = resvg.render().asPng();

  const outputPath = path.resolve("artifacts", `status-${target.id || "addr"}.png`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, png);

  const svgPath = path.resolve("artifacts", `status-${target.id || "addr"}.svg`);
  fs.writeFileSync(svgPath, svg, "utf8");

  console.log(`🖼️ [${target.name}] Картку збережено: ${outputPath}`);
  return outputPath;
}

export {
  computeOutageIntervals,
  formatIntervals,
  getKyivNow,
  resolveCurrentStatus,
  formatDateDisplay,
  addDaysToIsoDate,
  buildDateIndex,
  renderStatusCardSvg,
  wrapText,
};
