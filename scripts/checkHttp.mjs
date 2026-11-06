import { Impit } from "impit";

const url = process.env.DTEK_URL || "https://www.dtek-krem.com.ua/ua/shutdowns";

try {
  const client = new Impit({ browser: "chrome", followRedirects: true, timeout: 30000 });
  const response = await client.fetch(url, {
    headers: {
      "Accept-Language": "uk-UA,uk;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const html = await response.text();

  if (html.includes("DisconSchedule.fact")) {
    console.log("✅ ДТЕК доступний через HTTP — браузер не потрібен.");
    process.exit(0);
  }

  console.error("⚠️ ДТЕК не віддав графік через HTTP (схоже на Incapsula) — потрібен резервний браузер.");
  process.exit(1);
} catch (error) {
  console.error(`⚠️ HTTP-перевірка не вдалася: ${error.message} — потрібен резервний браузер.`);
  process.exit(1);
}
