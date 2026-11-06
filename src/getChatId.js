const cleanEnv = (val) => val ? String(val).trim().replace(/^['"]|['"]$/g, '') : undefined;
const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);

if (!token) {
  console.error("❌ Не задано TELEGRAM_BOT_TOKEN у .env");
  process.exit(1);
}

async function main() {
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=${encodeURIComponent(JSON.stringify(["message", "channel_post", "my_chat_member"]))}`);
  const data = await response.json().catch(() => null);

  if (!data?.ok) {
    throw new Error(data?.description || `HTTP ${response.status}`);
  }

  const updates = data.result || [];
  if (!updates.length) {
    console.log("ℹ️ Бот ще не бачив жодного чату.\n");
    console.log("Що зробити:");
    console.log("1. Додайте бота в супергрупу.");
    console.log("2. Напишіть будь-яке повідомлення в потрібній гілці (темі).");
    console.log("3. Запустіть цю команду ще раз: npm run chat-id");
    console.log("\nПорада: щоб бот бачив усі повідомлення, зробіть його адміністратором групи.");
    return;
  }

  const chats = new Map();
  const threads = new Map();

  for (const update of updates) {
    const message = update.message || update.channel_post || update.my_chat_member;
    const chat = message?.chat;
    if (!chat) continue;

    chats.set(chat.id, {
      id: chat.id,
      type: chat.type,
      title: chat.title || chat.username || chat.first_name,
    });

    const threadId = update.message?.message_thread_id;
    if (threadId) {
      threads.set(`${chat.id}:${threadId}`, {
        chatId: chat.id,
        threadId,
        name: update.message?.reply_to_message?.forum_topic_created?.name || "без назви",
      });
    }
  }

  console.log("💬 Знайдені чати:\n");
  for (const chat of chats.values()) {
    console.log(`  chat_id: ${chat.id}  (${chat.type})  ${chat.title || ""}`);
  }

  if (threads.size) {
    console.log("\n🧵 Знайдені гілки (Topics):\n");
    for (const thread of threads.values()) {
      console.log(`  thread_id: ${thread.threadId}  chat_id: ${thread.chatId}  «${thread.name}»`);
    }
  } else {
    console.log("\nℹ️ Гілок поки не видно. Напишіть повідомлення в кожній потрібній темі та запустіть команду знову.");
  }
}

main().catch((error) => {
  console.error(`❌ Помилка: ${error.message}`);
  process.exitCode = 1;
});
