import fs from "node:fs";
import path from "node:path";

const TELEGRAM_API = "https://api.telegram.org";
const MAX_CAPTION_LENGTH = 1024;
const MAX_RETRIES = 3;

function isNightInKyiv() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Kyiv",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  );
  return hour >= 22 || hour < 8;
}

function getKyivDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function truncateCaption(caption) {
  if (caption.length <= MAX_CAPTION_LENGTH) return caption;
  return `${caption.slice(0, MAX_CAPTION_LENGTH - 1)}…`;
}

function explainTelegramError(description) {
  if (/chat not found/i.test(description)) {
    return "чат не знайдено. Перевірте TELEGRAM_CHAT_ID і додайте бота в супергрупу (а також увімкніть йому право надсилати повідомлення).";
  }
  if (/bot was blocked/i.test(description)) {
    return "бот заблокований у цьому чаті.";
  }
  if (/not enough rights/i.test(description)) {
    return "у бота недостатньо прав для надсилання повідомлень у цю гілку.";
  }
  if (/message thread not found/i.test(description)) {
    return "гілку (thread_id) не знайдено. Перевірте номери тем у налаштуваннях супергрупи.";
  }
  return description;
}

async function callTelegram(token, method, payload, { formData = null, retries = MAX_RETRIES } = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const options = formData
        ? { method: "POST", body: formData }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          };

      const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, options);
      const data = await response.json().catch(() => null);

      if (data?.ok) return data;

      const description = data?.description || `HTTP ${response.status}`;

      if (/message is not modified/i.test(description)) {
        return { ok: true, result: null, notModified: true };
      }

      if (response.status === 429 && data?.parameters?.retry_after) {
        const waitMs = Math.min(data.parameters.retry_after, 30) * 1000;
        console.warn(`⏳ Telegram обмежив частоту запитів. Чекаю ${waitMs / 1000} с...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        lastError = new Error(description);
        continue;
      }

      if (response.status >= 500) {
        lastError = new Error(description);
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }

      throw new Error(`Telegram: ${explainTelegramError(description)}`);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  throw lastError || new Error("Telegram: невідома помилка");
}

function stateFilePath(targetId) {
  const safeId = String(targetId || "address").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.resolve("state", `state-${safeId}.json`);
}

function loadState(targetId) {
  const file = stateFilePath(targetId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function saveState(targetId, state) {
  const file = stateFilePath(targetId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2), "utf8");
}

export async function checkTelegramChat({ token, chatId }) {
  if (!token) throw new Error("Не задано TELEGRAM_BOT_TOKEN.");
  if (!chatId) throw new Error("Не задано TELEGRAM_CHAT_ID.");

  const response = await fetch(`${TELEGRAM_API}/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`);
  const data = await response.json().catch(() => null);

  if (!data?.ok) {
    throw new Error(`Telegram: ${explainTelegramError(data?.description || `HTTP ${response.status}`)}`);
  }

  return data.result;
}

export async function sendTelegramNotification({
  token,
  chatId,
  threadId,
  targetId,
  photoPath,
  caption,
  scheduleHash,
}) {
  if (!token || !chatId) {
    console.warn("⚠️ Telegram не налаштований — надсилання пропущено.");
    return { skipped: true };
  }

  const state = loadState(targetId);
  const currentDate = getKyivDate();
  const safeCaption = truncateCaption(caption);
  const messageThreadId = Number(threadId) > 0 ? String(threadId) : null;

  // Перевіряємо, чи є існуюче повідомлення за СЬОГОДНІ
  const isTodayMessage = Boolean(state?.messageId && state?.date === currentDate);
  const sameSchedule = Boolean(isTodayMessage && state?.scheduleHash === scheduleHash);

  if (isTodayMessage) {
    if (sameSchedule) {
      console.log(`🟡 [${targetId}] Графік не змінився — оновлюю підпис існуючого повідомлення.`);
      try {
        const result = await callTelegram(token, "editMessageCaption", {
          chat_id: chatId,
          message_id: state.messageId,
          caption: safeCaption,
          parse_mode: "HTML",
        });

        if (result.ok || result.notModified) {
          saveState(targetId, {
            ...state,
            scheduleHash,
            updatedAt: new Date().toISOString(),
          });
          console.log(`🟢 [${targetId}] Підпис оновлено.`);
        }
        return result;
      } catch (error) {
        console.warn(`⚠️ [${targetId}] Не вдалося оновити підпис (${error.message}). Надішлю нову картку.`);
      }
    } else {
      // Той самий день, але графік змінився!
      // Видаляємо попереднє повідомлення і надішлемо нове (щоб прийшов сповіщення-пуш, але не було спаму).
      console.log(`🔄 [${targetId}] Графік на сьогодні змінився! Видаляю попереднє повідомлення і надсилаю актуальне...`);
      try {
        await callTelegram(token, "deleteMessage", {
          chat_id: chatId,
          message_id: state.messageId,
        });
        console.log(`🗑️ [${targetId}] Попереднє повідомлення видалено.`);
      } catch (error) {
        console.warn(`⚠️ [${targetId}] Не вдалося видалити попереднє повідомлення: ${error.message}`);
      }
    }
  }

  // Надсилаємо нову картку на сьогодні
  console.log(`📤 [${targetId}] Надсилаю актуальну картку в Telegram${messageThreadId ? ` (гілка ${messageThreadId})` : ""}...`);

  const formData = new FormData();
  formData.append("chat_id", chatId);
  if (messageThreadId) formData.append("message_thread_id", messageThreadId);
  formData.append("caption", safeCaption);
  formData.append("parse_mode", "HTML");
  if (isNightInKyiv()) formData.append("disable_notification", "true");

  const photoBuffer = fs.readFileSync(photoPath);
  formData.append("photo", new Blob([photoBuffer], { type: "image/png" }), "schedule.png");

  const result = await callTelegram(token, "sendPhoto", null, { formData });

  if (result?.result?.message_id) {
    saveState(targetId, {
      messageId: result.result.message_id,
      scheduleHash,
      date: currentDate,
      chatId,
      threadId: messageThreadId,
      updatedAt: new Date().toISOString(),
    });
  }

  console.log(`🟢 [${targetId}] Картку надіслано (message_id: ${result?.result?.message_id}).`);
  return result;
}