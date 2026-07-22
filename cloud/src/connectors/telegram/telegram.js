import TelegramBot from "node-telegram-bot-api";
import { submitGoal } from "../../agent/goalManager.js";
import { executeActionRemotely } from "../../websocket/server.js";
import { COMMANDS, isCommand, runCommand } from "../../companion/commands.js";
import { listPersonas } from "../../companion/personas.js";
import { IDENTITY } from "../../companion/store.js";

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
      return await bot.sendMessage(chatId, String(text ?? "done.").slice(0, 4000) || "done.");
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
    let inFlight = null;
    let finished = false;

    const flush = () => {
      timer = null;
      if (finished) return;
      lastEdit = Date.now();
      const previous = inFlight;
      inFlight = (async () => {
        if (previous) { try { await previous; } catch {} }
        if (finished) return;
        const text = `⏳ ${latest}`;
        if (!messageId) {
          const sent = await say(chatId, text);
          messageId = sent?.message_id || messageId;
        } else {
          try {
            await bot.editMessageText(text, { chat_id: chatId, message_id: messageId });
          } catch {}
        }
      })();
    };

    return {
      update(status) {
        if (finished) return;
        latest = status.slice(0, 500);
        const wait = Math.max(0, STATUS_EDIT_INTERVAL_MS - (Date.now() - lastEdit));
        if (!timer) timer = setTimeout(flush, wait);
      },
      async finish(success, result) {
        finished = true;
        if (timer) { clearTimeout(timer); timer = null; }
        if (inFlight) { try { await inFlight; } catch {} }
        if (messageId) {
          try { await bot.deleteMessage(chatId, messageId); } catch {}
        }
        await say(chatId, result);
      }
    };
  }

  bot.setMyCommands(
    COMMANDS.map(c => ({ command: c.name.slice(1), description: c.help }))
  ).catch(() => {});

  bot.on("callback_query", async (q) => {
    try {
      const chatId = q.message?.chat?.id;
      const data = q.data || "";
      if (!chatId || !data.startsWith("persona:")) return;
      const reply = await runCommand(IDENTITY, `/personality ${data.split(":")[1]}`);
      try { await bot.answerCallbackQuery(q.id); } catch {}
      await say(chatId, reply);
    } catch (err) {
      console.log(`[TELEGRAM] callback failed: ${err.message}`);
    }
  });

  bot.on("message", async (msg) => {
    try {
      await handleMessage(msg);
    } catch (err) {
      console.log(`[TELEGRAM] message failed: ${err.message}`);
      say(msg?.chat?.id, "something broke handling that — try again.");
    }
  });

  async function handleMessage(msg) {
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

    if (/^\/(personality|start)$/.test(text)) {
      const buttons = listPersonas().map(p => [{ text: `${p.label} — ${p.blurb.slice(0, 28)}`, callback_data: `persona:${p.id}` }]);
      try {
        await bot.sendMessage(chatId, "who do you want me to be?", { reply_markup: { inline_keyboard: buttons } });
      } catch {}
      return;
    }

    if (isCommand(text)) {
      const reply = await runCommand(IDENTITY, text);
      await say(chatId, reply);
      return;
    }

    const status = statusUpdater(chatId);
    status.update("thinking…");

    submitGoal({
      goal: text,
      chatId: IDENTITY,
      executeAction: executeActionRemotely,
      askHuman: askHumanFactory(chatId),
      onStatus: (s) => status.update(s),
      onResult: (success, result) => status.finish(success, result)
    });
  }

  console.log("[TELEGRAM] Bot started");
  return bot;
}
