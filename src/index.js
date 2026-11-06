import crypto from "node:crypto";
import { getAddressSchedule, closeDtekResources } from "./dtekApi.js";
import { renderStatusCard } from "./renderer.js";
import { buildCaption } from "./caption.js";
import { sendTelegramNotification, checkTelegramChat } from "./telegram.js";

function parseTargets() {
  const raw = process.env.TARGETS;
  if (!raw) throw new Error("Не задано змінну TARGETS (список адрес у форматі JSON).");

  let targets;
  try {
    targets = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Не вдалося розібрати TARGETS як JSON: ${error.message}`);
  }

  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("TARGETS має бути непорожнім масивом адрес.");
  }

  return targets.map((target, index) => {
    const required = ["name", "city", "street", "house"];
    for (const field of required) {
      if (!target[field] || String(target[field]).trim() === "") {
        throw new Error(`У TARGETS[${index}] не заповнено поле «${field}».`);
      }
    }
    return {
      ...target,
      id: target.id || `address_${index + 1}`,
      thread_id: target.thread_id != null ? target.thread_id : null,
    };
  });
}

function createScheduleHash(scheduleData) {
  const payload = {
    groups: scheduleData.groups,
    data: scheduleData.fact?.data,
    update: scheduleData.fact?.update,
    alertMessage: scheduleData.alertMessage,
    currentOutage: scheduleData.currentOutage,
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function runCheck() {
  console.log(`\n🚀 [${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}] Запуск перевірки графіків ДТЕК КРЕМ`);

  const cleanEnv = (val) => val ? String(val).trim().replace(/^['"]|['"]$/g, '') : undefined;
  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const chatId = cleanEnv(process.env.TELEGRAM_CHAT_ID);
  const targets = parseTargets();

  console.log(`📍 Адрес у списку: ${targets.length}`);

  const failures = [];
  let telegramReady = Boolean(token && chatId);
  if (telegramReady) {
    try {
      const chat = await checkTelegramChat({ token, chatId });
      console.log(`💬 Telegram-чат: ${chat.title || chat.username || chat.id} (${chat.type})`);
    } catch (error) {
      telegramReady = false;
      console.error(`❌ Telegram недоступний: ${error.message}`);
      console.error("ℹ️ Картки буде згенеровано локально, але надсилання пропущено.");
      failures.push({ target: "Telegram", error: error.message });
    }
  } else {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID не задані — картки буде лише збережено локально.");
  }

  try {
    for (const target of targets) {
      console.log("\n────────────────────────────────────────");
      console.log(`🔍 Обробка адреси: ${target.name} (${target.city}, ${target.street}, ${target.house})`);

      try {
        const scheduleData = await getAddressSchedule(target);
        const scheduleHash = createScheduleHash(scheduleData);
        const photoPath = await renderStatusCard(target, scheduleData, {
          alertMessage: scheduleData.alertMessage,
          currentOutage: scheduleData.currentOutage,
        });

        if (telegramReady) {
          const caption = buildCaption(target, scheduleData);
          await sendTelegramNotification({
            token,
            chatId,
            threadId: target.thread_id,
            targetId: target.id,
            photoPath,
            caption,
            scheduleHash,
          });
        } else {
          console.log(`ℹ️ [${target.name}] Telegram вимкнено — картку збережено: ${photoPath}`);
        }
      } catch (error) {
        failures.push({ target: target.name, error: error.message });
        console.error(`❌ Помилка для «${target.name}»: ${error.message}`);
      }
    }
  } finally {
    await closeDtekResources();
  }

  console.log("\n════════════════════════════════════════");
  if (failures.length) {
    console.error(`⚠️ Завершено з помилками: ${failures.length}`);
    for (const failure of failures) {
      console.error(`   • ${failure.target}: ${failure.error}`);
    }
    return false;
  } else {
    console.log(`🏁 Готово. Успішно оброблено адрес: ${targets.length}`);
    return true;
  }
}

async function main() {
  const isLoopMode = process.argv.includes("--loop") || process.env.LOOP === "true";
  const intervalMinutes = Number(process.env.CHECK_INTERVAL_MINUTES || 30);

  if (!isLoopMode) {
    const success = await runCheck();
    if (!success) process.exitCode = 1;
    return;
  }

  console.log(`🔄 Бот запущений у безперервному режимі (петля). Інтервал: ${intervalMinutes} хв.`);
  
  while (true) {
    try {
      await runCheck();
    } catch (error) {
      console.error(`💥 Критична помилка циклу: ${error.message}`);
    }

    console.log(`⏳ Наступна перевірка через ${intervalMinutes} хв... (${new Date(Date.now() + intervalMinutes * 60000).toLocaleTimeString("uk-UA", { timeZone: "Europe/Kyiv" })})`);
    await new Promise((resolve) => setTimeout(resolve, intervalMinutes * 60000));
  }
}

main().catch((error) => {
  console.error(`💥 Критична помилка: ${error.message}`);
  process.exitCode = 1;
});
