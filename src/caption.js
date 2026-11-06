import {
  computeOutageIntervals,
  formatIntervals,
  getKyivNow,
  formatDateDisplay,
  addDaysToIsoDate,
  buildDateIndex,
  resolveCurrentStatus,
} from "./renderer.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildCaption(target, scheduleData) {
  const now = getKyivNow();
  const fact = scheduleData?.fact;
  const preset = scheduleData?.preset;
  const groups = scheduleData?.groups || [];
  const dateIndex = fact ? buildDateIndex(fact) : new Map();

  const todayIso = now.date;
  const tomorrowIso = addDaysToIsoDate(todayIso, 1);
  const todayKey = dateIndex.get(todayIso) || null;
  const tomorrowKey = dateIndex.get(tomorrowIso) || null;
  const todayData = todayKey && fact?.data?.[todayKey] ? fact.data[todayKey] : null;
  const tomorrowData = tomorrowKey && fact?.data?.[tomorrowKey] ? fact.data[tomorrowKey] : null;

  const groupNames = groups.map((g) => preset?.sch_names?.[g] || g);
  const groupLine = groupNames.length > 1
    ? groupNames.map((name, i) => `Лінія ${i + 1}: ${name}`).join(" • ")
    : groupNames[0] || "не визначена";

  const lines = [
    `⚡️ <b>Графік відключень: ${escapeHtml(target.name)}</b>`,
    `📍 <i>${escapeHtml(`${target.city}, ${target.street}, буд. ${target.house}`)}</i>`,
    `🔌 <b>${escapeHtml(groupLine)}</b>`,
    "",
    `📅 <b>Сьогодні, ${formatDateDisplay(todayIso)}</b>`,
  ];

  if (todayData) {
    if (groups.length > 1) {
      lines.push("ℹ️ У будинку дві лінії живлення — графік дивіться на картці.");
    } else {
      const hours = todayData[groups[0]];
      const current = resolveCurrentStatus(hours, now);
      const intervals = computeOutageIntervals(hours);
      lines.push(`Статус зараз: <b>${current.text}</b>`);
      if (intervals.off.length) {
        lines.push(`🪫 Відключення: <code>${formatIntervals(intervals.off)}</code>`);
      } else {
        lines.push("🔋 Відключень не передбачено");
      }
      if (intervals.maybe.length) {
        lines.push(`⚠️ Можливо: <code>${formatIntervals(intervals.maybe)}</code>`);
      }
    }
  } else {
    lines.push("ℹ️ Інформація від НЕК «Укренерго» ще не надходила.");
  }

  lines.push("", `📅 <b>Завтра, ${formatDateDisplay(tomorrowIso)}</b>`);
  if (tomorrowData && groups.length === 1 && tomorrowData[groups[0]]) {
    const intervals = computeOutageIntervals(tomorrowData[groups[0]]);
    if (intervals.off.length) {
      lines.push(`🪫 Відключення: <code>${formatIntervals(intervals.off)}</code>`);
    } else {
      lines.push("🔋 Відключень не передбачено");
    }
    if (intervals.maybe.length) {
      lines.push(`⚠️ Можливо: <code>${formatIntervals(intervals.maybe)}</code>`);
    }
  } else if (tomorrowData) {
    lines.push("ℹ️ Графік на завтра дивіться на картці.");
  } else {
    lines.push("ℹ️ Інформація від НЕК «Укренерго» про обмеження на наступний день ще не надходила.");
  }

  if (scheduleData?.currentOutage?.reason) {
    const outage = scheduleData.currentOutage;
    lines.push("", "🔴 <b>Зараз без світла</b>");
    lines.push(`Причина: ${escapeHtml(outage.reason)}`);
    if (outage.end) lines.push(`Орієнтовно до: <b>${escapeHtml(outage.end)}</b>`);
  }

  lines.push(
    "",
    `🕐 <i>Оновлено: ${escapeHtml(new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" }))}</i>`
  );

  let caption = lines.join("\n");
  if (caption.length > 1024) caption = `${caption.slice(0, 1023)}…`;
  return caption;
}
