import { Telegraf } from "telegraf";
import { config } from "../config/env.js";
import { getChatCompletion } from "./llmService.js";
import { Message } from "../models.js";
import { isConnected } from "./db.js";
import {
  queueTask,
  cancelAllTasks,
  hasPendingTasksForChat,
} from "./taskService.js";
import fs from "fs";
import path from "path";

let bot = null;
const mockMessages = [];
const runningAgentLoops = new Set();

const targetName = (config.ALLOWED_TELEGRAM_USER || "user")
  .split(" ")
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(" ");
const targetFirstName = targetName.split(" ")[0];

function loadPrompt(filename, replacements = {}) {
  try {
    const filePath = path.join(process.cwd(), "prompts", filename);
    let content = fs.readFileSync(filePath, "utf8");
    for (const [key, value] of Object.entries(replacements)) {
      content = content.replaceAll(`\${${key}}`, value);
    }
    return content;
  } catch (err) {
    console.error(`Failed to load prompt ${filename}:`, err.message);
    return "";
  }
}

function getFriendlyActionMessage(name, targetFirstName, args = {}) {
  const templates = {
    openUrl: [
      `Opening up that website link for you right now, ${targetFirstName}!`,
      `Let me open that page on your browser...`,
      `Getting that web page opened for you, ${targetFirstName}!`,
    ],
    openYoutubeVideo: [
      `Opening YouTube to play that video for you now! 🎵`,
      `Searching YouTube and playing that for you right away.`,
      `Getting that video queued up on YouTube!`,
    ],
    openLeetcodeDaily: [
      `Opening the LeetCode daily coding question for you. Good luck, I know you'll crush it! 💻`,
      `Loading today's LeetCode coding challenge... let's get solving!`,
      `Getting the daily LeetCode challenge opened for you.`,
    ],
    openFolder: [
      `Opening up that folder on your screen now.`,
      `Let me reveal that directory for you...`,
      `Opening the folder. Let me know if there's anything else you need inside!`,
    ],
    sendWhatsApp: [
      `Sending that WhatsApp message to ${args.recipient || "your contact"} right away.`,
      `Getting that message sent on WhatsApp...`,
      `On it! Sending the WhatsApp message.`,
    ],
    webSearch: [
      `Searching the web for "${args.query || "your query"}" now...`,
      `Let me search the web for that...`,
      `Running a quick web search now...`,
    ],
    webExtract: [
      `Opening that page to read the content for you...`,
      `Extracting the webpage content...`,
      `Reading through the page content now...`,
    ],
    manageApplication: [
      `Triggering that application action now...`,
      `On it! Managing the application state.`,
    ],
    captureScreen: [
      `Capturing a screenshot of your screen to take a look...`,
      `Let me capture your screen details...`,
    ],
  };

  const options = templates[name] || [
    `I'm starting up ${name} on your computer right now...`,
    `Sure thing! Running ${name} for you now.`,
    `Just a second, triggering ${name} on your PC!`,
  ];

  return options[Math.floor(Math.random() * options.length)];
}

function isUserAllowed(ctx) {
  const allowedUser = config.ALLOWED_TELEGRAM_USER.toLowerCase();
  const username = (ctx.from?.username || "").toLowerCase();
  const firstName = (ctx.from?.first_name || "").toLowerCase();

  return (
    username === "saikoukami" ||
    username.includes(allowedUser) ||
    firstName.includes(allowedUser)
  );
}

async function saveMessage(chatId, role, content, extra = {}) {
  try {
    if (isConnected()) {
      await Message.create({ chatId, role, content, ...extra });
    } else {
      mockMessages.push({
        chatId,
        role,
        content,
        ...extra,
        timestamp: new Date(),
      });
    }
  } catch (err) {
    console.error("Failed to save message to history:", err.message);
  }
}

function normalizeOutgoingText(text) {
  if (typeof text !== "string") return "";
  return text.trim();
}

async function replySafe(ctx, text) {
  const messageText = normalizeOutgoingText(text);
  if (!messageText) return;
  await ctx.reply(messageText);
}

function toPlain(value) {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function dbMessageToLlmMessage(message) {
  const llmMessage = { role: message.role };

  if (message.role === "tool") {
    if (message.raw_content) {
      const rawContent = message.raw_content;
      llmMessage.content = Array.isArray(rawContent)
        ? rawContent.map((part) => toPlain(part))
        : toPlain(rawContent);
    } else {
      llmMessage.content = message.content || "";
    }
  } else if (message.content !== undefined && message.content !== null) {
    llmMessage.content = message.content;
  }

  if (message.name) llmMessage.name = message.name;
  if (message.tool_call_id) llmMessage.tool_call_id = message.tool_call_id;
  if (message.tool_calls) {
    try {
      llmMessage.tool_calls =
        typeof message.tool_calls === "string"
          ? JSON.parse(message.tool_calls)
          : toPlain(message.tool_calls);
    } catch (error) {
      console.warn(
        "Failed to parse tool_calls from DB message:",
        error.message,
      );
    }
  }

  return llmMessage;
}

function mockMessageToLlmMessage(message) {
  const llmMessage = { role: message.role };

  if (message.role === "tool") {
    if (message.raw_content) {
      const rawContent = message.raw_content;
      llmMessage.content = Array.isArray(rawContent)
        ? rawContent.map((part) => toPlain(part))
        : toPlain(rawContent);
    } else {
      llmMessage.content = message.content || "";
    }
  } else if (message.content !== undefined && message.content !== null) {
    llmMessage.content = message.content;
  }

  if (message.name) llmMessage.name = message.name;
  if (message.tool_call_id) llmMessage.tool_call_id = message.tool_call_id;
  if (message.tool_calls) {
    try {
      llmMessage.tool_calls =
        typeof message.tool_calls === "string"
          ? JSON.parse(message.tool_calls)
          : toPlain(message.tool_calls);
    } catch (error) {
      console.warn(
        "Failed to parse tool_calls from mock message:",
        error.message,
      );
    }
  }

  return llmMessage;
}

async function getRecentHistory(chatId, limit = 30) {
  if (isConnected()) {
    const dbMsgs = await Message.find({ chatId })
      .sort({ timestamp: 1 })
      .limit(limit);
    return dbMsgs.map(dbMessageToLlmMessage);
  }

  return mockMessages
    .filter((message) => message.chatId === chatId)
    .slice(-limit)
    .map(mockMessageToLlmMessage);
}

async function runAgentLoop(
  chatId,
  originalTask,
  replyFn = null,
  maxIterations = 10,
) {
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const history = await getRecentHistory(chatId);
    const systemPrompt = {
      role: "system",
      content: loadPrompt("systemPrompt.txt", { targetName, targetFirstName }),
    };

    const messages = [systemPrompt, ...history];
    const llmRes = await getChatCompletion(messages);
    const content = normalizeOutgoingText(llmRes.content);

    if (llmRes.toolCalls && llmRes.toolCalls.length > 0) {
      await saveMessage(chatId, "assistant", content || null, {
        tool_calls: llmRes.toolCalls,
      });

      if (content) {
        if (replyFn) {
          await replyFn(content);
        } else {
          await sendSafeMessage(chatId, content);
        }
      }

      for (const toolCall of llmRes.toolCalls) {
        const { name, arguments: argsString } = toolCall.function;

        let args = {};
        try {
          args = JSON.parse(argsString);
        } catch {
          args = {};
        }

        const payload = {
          ...args,
          toolCallId:
            toolCall.id || `call_${Math.random().toString(36).substring(2, 9)}`,
          chatId,
          task: originalTask,
        };

        await queueTask(name, payload);

        if (!content) {
          const friendly = getFriendlyActionMessage(
            name,
            targetFirstName,
            args,
          );
          if (replyFn) {
            await replyFn(friendly);
          } else {
            await sendSafeMessage(chatId, friendly);
          }
        }
      }

      // Exit here. The loop continues when queued tool tasks call handleTaskCompletion.
      return;
    }

    if (content) {
      if (replyFn) {
        await replyFn(content);
      } else {
        await sendSafeMessage(chatId, content);
      }
      await saveMessage(chatId, "assistant", content);
      return;
    }

    // No content and no tool calls; stop this cycle safely.
    return;
  }

  await sendSafeMessage(
    chatId,
    "I ran into a loop trying to complete that. Please try again.",
  );
}

export function initBot() {
  if (bot) {
    console.log("Bot already initialized; skipping second init.");
    return;
  }
  if (!config.TELEGRAM_BOT_TOKEN) {
    console.warn(
      "WARNING: TELEGRAM_BOT_TOKEN is missing. Bot will not initialize.",
    );
    return;
  }

  bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

  bot.start((ctx) => {
    if (!isUserAllowed(ctx)) {
      return replySafe(
        ctx,
        `Sorry, only ${targetFirstName} is allowed to command this PC.`,
      );
    }
    replySafe(
      ctx,
      `Hey ${targetFirstName}! I'm here and ready to help you with anything you need on your computer. Let me know what you'd like to do.`,
    );
  });

  bot.on("text", async (ctx) => {
    if (!isUserAllowed(ctx)) {
      return replySafe(
        ctx,
        `Sorry, only ${targetFirstName} is allowed to command this PC.`,
      );
    }

    const chatId = ctx.chat.id;
    const userText = ctx.message.text.trim();
    const lowerText = userText.toLowerCase();

    // Interrupt/Cancel commands
    if (
      lowerText === "stop" ||
      lowerText === "cancel" ||
      lowerText === "no" ||
      lowerText === "halt" ||
      lowerText === "abort"
    ) {
      try {
        await cancelAllTasks();
        await saveMessage(chatId, "user", userText);
        const replyText =
          "I've stopped all active and pending commands on your computer. Let me know what you'd like to do next.";
        await replySafe(ctx, replyText);
        await saveMessage(chatId, "assistant", replyText);
        return;
      } catch (err) {
        console.error("Failed to cancel tasks:", err.message);
      }
    }

    try {
      await saveMessage(chatId, "user", userText);
      await runAgentLoop(chatId, userText, (text) => replySafe(ctx, text));
    } catch (err) {
      console.error("Telegraf update handler error:", err);
      replySafe(
        ctx,
        `Oh no, I ran into a little trouble: ${err.message || err}. Let's try that again!`,
      );
    }
  });

  bot
    .launch()
    .then(() => console.log("Telegram Bot successfully running."))
    .catch((err) =>
      console.error("Telegram Bot failed to start:", err.message),
    );
}

// Helper to safely send messages that might exceed Telegram's 4096 character limit
async function sendSafeMessage(chatId, text) {
  const messageText = normalizeOutgoingText(text);
  if (!messageText) return;
  const limit = 4000;
  if (messageText.length <= limit) {
    await bot.telegram.sendMessage(chatId, messageText);
    return;
  }

  const chunks = [];
  let current = "";
  const lines = messageText.split("\n");

  for (const line of lines) {
    if (line.length > limit) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < line.length; i += limit) {
        chunks.push(line.slice(i, i + limit));
      }
    } else if ((current + "\n" + line).length > limit) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + "\n" + line : line;
    }
  }
  if (current) {
    chunks.push(current);
  }

  for (const chunk of chunks) {
    if (chunk.trim()) {
      await bot.telegram.sendMessage(chatId, chunk);
    }
  }
}

export async function handleTaskCompletion(task) {
  if (!bot || !task.payload?.chatId) return;

  const { chatId } = task.payload;
  const { commandType, status, result } = task;

  const imageToolCommands = new Set([
    "captureScreen",
    "checkWhatsAppStatuses",
    "readWhatsAppStatus",
    "readWhatsAppLastConversation",
    "captureWindow",
  ]);

  let toolResultContent;
  let contentForStorage;
  let rawContentForStorage;

  if (status === "failed") {
    toolResultContent = `Error executing tool ${commandType}: ${result || "unknown error"}`;
    contentForStorage = toolResultContent;
  } else if (imageToolCommands.has(commandType) && result) {
    toolResultContent = [
      { type: "text", text: "Screenshot captured successfully." },
      {
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${result}` },
      },
    ];
    contentForStorage = "Screenshot captured successfully.";
    rawContentForStorage = toolResultContent;
  } else {
    toolResultContent = result || "Done.";
    contentForStorage =
      typeof toolResultContent === "string"
        ? toolResultContent
        : JSON.stringify(toolResultContent);
  }

  await saveMessage(chatId, "tool", contentForStorage, {
    name: commandType,
    tool_call_id: task.payload?.toolCallId || "call_default",
    raw_content: rawContentForStorage,
  });

  const hasMorePending = await hasPendingTasksForChat(chatId);
  if (hasMorePending) {
    console.log(
      `Still waiting for other tasks to complete for chat ${chatId}.`,
    );
    return;
  }

  if (runningAgentLoops.has(chatId)) {
    console.log(`Agent loop already running for chat ${chatId}, skipping.`);
    return;
  }

  runningAgentLoops.add(chatId);
  try {
    await runAgentLoop(chatId, task.payload?.task || "");
  } catch (err) {
    console.error("Agent completion iteration error:", err);
    await sendSafeMessage(
      chatId,
      `Oh no, I ran into a little trouble: ${err.message || err}. Let's try that again!`,
    );
  } finally {
    runningAgentLoops.delete(chatId);
  }
}

export function shutdownBot() {
  if (bot) {
    bot.stop("SIGINT");
  }
}
