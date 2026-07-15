import TelegramBot from "node-telegram-bot-api";
import { submitGoal } from "../../agent/goalManager.js";
import { executeActionRemotely } from "../../websocket/server.js";

const STATUS_EDIT_INTERVAL_MS = 3500;
const HUMAN_TIMEOUT_MS = 300000;

export function startTelegramBot(token) {
  if (!token) {
    console.log("[TELEGRAM] No token configured, skipping");
    return null;
  }

  const bot = new TelegramBot(token, { polling: true });
  bot.on("polling_error", () => {});

  const pendingAsks = new Map();

  const say = async (chatId, text) => {
    try {
      return await bot.sendMessage(chatId, text.slice(0, 4000));
    } catch {
      return null;
    }
  };

  function askHumanFactory(chatId) {
    return (question, { secretName } = {}) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingAsks.delete(chatId);
          reject(new Error("no reply within 5 minutes"));
        }, HUMAN_TIMEOUT_MS);
        pendingAsks.set(chatId, { resolve, timer, secret: Boolean(secretName) });
        const suffix = secretName
          ? "\n\n(This will be stored only on your own computer, and I'll delete your message here after reading it.)"
          : "";
        say(chatId, `❓ ${question}${suffix}`);
      });
  }

  function statusUpdater(chatId) {
    let messageId = null;
    let lastEdit = 0;
    let latest = "";
    let timer = null;

    const flush = async () => {
      timer = null;
      lastEdit = Date.now();
      if (!messageId) {
        const sent = await say(chatId, `⏳ ${latest}`);
        messageId = sent?.message_id || null;
      } else {
        try {
          await bot.editMessageText(`⏳ ${latest}`, { chat_id: chatId, message_id: messageId });
        } catch {}
      }
    };

    return {
      update(status) {
        latest = status.slice(0, 500);
        const wait = Math.max(0, STATUS_EDIT_INTERVAL_MS - (Date.now() - lastEdit));
        if (!timer) timer = setTimeout(flush, wait);
      },
      async finish(success, result) {
        if (timer) { clearTimeout(timer); timer = null; }
        if (messageId) {
          try { await bot.deleteMessage(chatId, messageId); } catch {}
        }
        await say(chatId, `${success ? "✅" : "❌"} ${result}`);
      }
    };
  }

  bot.on("message", async (msg) => {
    const text = msg.text?.trim();
    const chatId = msg.chat.id;
    if (!text) return;

    const pendingAsk = pendingAsks.get(chatId);
    if (pendingAsk) {
      pendingAsks.delete(chatId);
      clearTimeout(pendingAsk.timer);
      if (pendingAsk.secret) {
        try { await bot.deleteMessage(chatId, msg.message_id); } catch {}
      }
      pendingAsk.resolve(text);
      return;
    }

    const status = statusUpdater(chatId);
    status.update("Working on it…");

    submitGoal({
      goal: text,
      executeAction: executeActionRemotely,
      askHuman: askHumanFactory(chatId),
      onStatus: (s) => status.update(s),
      onResult: (success, result) => status.finish(success, result)
    });
  });

  console.log("[TELEGRAM] Bot started");
  return bot;
}
