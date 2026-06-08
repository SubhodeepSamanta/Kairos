import { Telegraf } from "telegraf";
import { config } from "../config/env.js";
import { getChatCompletion, analyzeImage } from "./llmService.js";
import { Message, Task } from "../models.js";
import { isConnected } from "./db.js";
import { queueTask, cancelAllTasks } from "./taskService.js";
import fs from 'fs';
import path from 'path';

let bot = null;
const mockMessages = [];

const targetName = (config.ALLOWED_TELEGRAM_USER || "user")
  .split(" ")
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(" ");
const targetFirstName = targetName.split(" ")[0];

function loadPrompt(filename, replacements = {}) {
  try {
    const filePath = path.join(process.cwd(), 'prompts', filename);
    let content = fs.readFileSync(filePath, 'utf8');
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
      `Getting that web page opened for you, ${targetFirstName}!`
    ],
    openYoutubeVideo: [
      `Opening YouTube to play that video for you now! 🎵`,
      `Searching YouTube and playing that for you right away.`,
      `Getting that video queued up on YouTube!`
    ],
    openLeetcodeDaily: [
      `Opening the LeetCode daily coding question for you. Good luck, I know you'll crush it! 💻`,
      `Loading today's LeetCode coding challenge... let's get solving!`,
      `Getting the daily LeetCode challenge opened for you.`
    ],
    openFolder: [
      `Opening up that folder on your screen now.`,
      `Let me reveal that directory for you...`,
      `Opening the folder. Let me know if there's anything else you need inside!`
    ],
    sendWhatsApp: [
      `Sending that WhatsApp message to ${args.recipient || 'your contact'} right away.`,
      `Getting that message sent on WhatsApp...`,
      `On it! Sending the WhatsApp message.`
    ],
    webSearch: [
      `Searching the web for "${args.query || 'your query'}" now...`,
      `Let me search the web for that...`,
      `Running a quick web search now...`
    ],
    webExtract: [
      `Opening that page to read the content for you...`,
      `Extracting the webpage content...`,
      `Reading through the page content now...`
    ],
    manageApplication: [
      `Triggering that application action now...`,
      `On it! Managing the application state.`
    ],
    captureScreen: [
      `Capturing a screenshot of your screen to take a look...`,
      `Let me capture your screen details...`
    ]
  };

  const options = templates[name] || [
    `I'm starting up ${name} on your computer right now...`,
    `Sure thing! Running ${name} for you now.`,
    `Just a second, triggering ${name} on your PC!`
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
      mockMessages.push({ chatId, role, content, ...extra, timestamp: new Date() });
    }
  } catch (err) {
    console.error("Failed to save message to history:", err.message);
  }
}

export function initBot() {
  if (bot) {
    console.log('Bot already initialized; skipping second init.');
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
      return ctx.reply(`Sorry, only ${targetFirstName} is allowed to command this PC.`);
    }
    ctx.reply(
      `Hey ${targetFirstName}! I'm here and ready to help you with anything you need on your computer. Let me know what you'd like to do.`,
    );
  });

  bot.on("text", async (ctx) => {
    if (!isUserAllowed(ctx)) {
      return ctx.reply(`Sorry, only ${targetFirstName} is allowed to command this PC.`);
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
        ctx.reply(replyText);
        await saveMessage(chatId, "assistant", replyText);
        return;
      } catch (err) {
        console.error("Failed to cancel tasks:", err.message);
      }
    }

    try {
      await saveMessage(chatId, "user", userText);

      let history = [];
      if (isConnected()) {
        const dbMsgs = await Message.find({ chatId })
          .sort({ timestamp: 1 })
          .limit(30);
        history = dbMsgs.map((m) => {
          const msg = { role: m.role };
          if (m.content !== undefined && m.content !== null) msg.content = m.content;
          if (m.name) msg.name = m.name;
          if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
          if (m.tool_calls) msg.tool_calls = m.tool_calls;
          return msg;
        });
      } else {
        history = mockMessages
          .filter((m) => m.chatId === chatId)
          .slice(-30)
          .map((m) => {
            const msg = { role: m.role };
            if (m.content !== undefined && m.content !== null) msg.content = m.content;
            if (m.name) msg.name = m.name;
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
            if (m.tool_calls) msg.tool_calls = m.tool_calls;
            return msg;
          });
      }

      const systemPrompt = {
        role: "system",
        content: loadPrompt('systemPrompt.txt', { targetName, targetFirstName })
      };

      const messages = [systemPrompt, ...history];
      const llmRes = await getChatCompletion(messages);

      if (llmRes.toolCalls && llmRes.toolCalls.length > 0) {
        await saveMessage(chatId, "assistant", llmRes.content || null, { tool_calls: llmRes.toolCalls });

        if (llmRes.content) {
          ctx.reply(llmRes.content);
        }

        for (const toolCall of llmRes.toolCalls) {
          const { name, arguments: argsString } = toolCall.function;

          let args = {};
          try {
            args = JSON.parse(argsString);
          } catch (e) {
            console.error("Failed to parse tool call arguments:", argsString);
            throw new Error(
              `Invalid arguments returned from LLM for tool ${name}`,
            );
          }

          const payload = { 
            ...args, 
            toolCallId: toolCall.id || `call_${Math.random().toString(36).substring(2, 9)}`,
            chatId,
            task: userText
          };
          await queueTask(name, payload);

          if (!llmRes.content) {
            ctx.reply(getFriendlyActionMessage(name, targetFirstName, args));
          }
        }
      } else if (llmRes.content) {
        ctx.reply(llmRes.content);
        await saveMessage(chatId, "assistant", llmRes.content);
      }
    } catch (err) {
      console.error("Telegraf update handler error:", err);
      ctx.reply(
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
  if (!text) return;
  const limit = 4000;
  if (text.length <= limit) {
    await bot.telegram.sendMessage(chatId, text);
    return;
  }

  const chunks = [];
  let current = "";
  const lines = text.split("\n");

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

  let toolResult = result || '';

  if (status === "failed") {
    toolResult = `Error executing tool ${commandType}: ${result || 'unknown error'}`;
  } else {
    // Handle vision actions
    if (
      commandType === "checkWhatsAppStatuses" ||
      commandType === "readWhatsAppStatus" ||
      commandType === "readWhatsAppLastConversation" ||
      commandType === "captureScreen"
    ) {
      await sendSafeMessage(
        chatId,
        "I've got the screen details! Just reading through it now for you...",
      );

      try {
        let visionPrompt = "";
        if (commandType === "checkWhatsAppStatuses") {
          visionPrompt = loadPrompt('visionCheckStatuses.txt');
        } else if (commandType === "readWhatsAppStatus") {
          visionPrompt = loadPrompt('visionReadStatus.txt');
        } else if (commandType === "readWhatsAppLastConversation") {
          visionPrompt = loadPrompt('visionReadConversation.txt');
        } else if (commandType === "captureScreen") {
          visionPrompt = loadPrompt('visionCaptureScreen.txt');
        }

        console.log("Calling vision analysis, base64 length:", result?.length);
        const analysis = await analyzeImage(result, visionPrompt);
        toolResult = analysis;
      } catch (err) {
        console.error("Vision analysis callback error:", err.message);
        toolResult = `Error analyzing screenshot: ${err.message}`;
      }
    } else if (commandType === 'webSearch' && result?.startsWith('SEARCH_RESULTS|||')) {
      const rawData = result.replace('SEARCH_RESULTS|||', '');
      try {
        const searchResults = JSON.parse(rawData);
        toolResult = searchResults
          .map(r => `[Title]: ${r.title}\n[URL]: ${r.url}\n[Description]: ${r.description}`)
          .join('\n\n');
      } catch {
        toolResult = result;
      }
    } else if (commandType === 'webExtract' && result?.startsWith('EXTRACT_CONTENT|||')) {
      const parts = result.replace('EXTRACT_CONTENT|||', '').split('|||');
      toolResult = parts.slice(2).join('|||');
    }
  }

  // Save tool result
  await saveMessage(chatId, "tool", toolResult, {
    name: commandType,
    tool_call_id: task.payload?.toolCallId || 'call_default'
  });

  // Check if there are other pending or running tasks for this chat
  let hasMorePending = false;
  if (isConnected()) {
    const otherTasks = await Task.find({
      status: { $in: ['pending', 'running'] },
      'payload.chatId': chatId
    });
    hasMorePending = otherTasks.length > 0;
  } else {
    hasMorePending = mockTasks.some(t => 
      (t.status === 'pending' || t.status === 'running') && 
      t.payload?.chatId === chatId
    );
  }

  if (hasMorePending) {
    console.log(`Still waiting for other tasks to complete for chat ${chatId}.`);
    return;
  }

  // All tasks completed, call LLM again
  try {
    let history = [];
    if (isConnected()) {
      const dbMsgs = await Message.find({ chatId })
        .sort({ timestamp: 1 })
        .limit(30);
      history = dbMsgs.map((m) => {
        const msg = { role: m.role };
        if (m.content !== undefined && m.content !== null) msg.content = m.content;
        if (m.name) msg.name = m.name;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        return msg;
      });
    } else {
      history = mockMessages
        .filter((m) => m.chatId === chatId)
        .slice(-30)
        .map((m) => {
          const msg = { role: m.role };
          if (m.content !== undefined && m.content !== null) msg.content = m.content;
          if (m.name) msg.name = m.name;
          if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
          if (m.tool_calls) msg.tool_calls = m.tool_calls;
          return msg;
        });
    }

    const systemPrompt = {
      role: "system",
      content: loadPrompt('systemPrompt.txt', { targetName, targetFirstName })
    };

    const messages = [systemPrompt, ...history];
    const llmRes = await getChatCompletion(messages);

    if (llmRes.toolCalls && llmRes.toolCalls.length > 0) {
      await saveMessage(chatId, "assistant", llmRes.content || null, { tool_calls: llmRes.toolCalls });

      if (llmRes.content) {
        await sendSafeMessage(chatId, llmRes.content);
      }

      for (const toolCall of llmRes.toolCalls) {
        const { name, arguments: argsString } = toolCall.function;

        let args = {};
        try {
          args = JSON.parse(argsString);
        } catch (e) {
          console.error("Failed to parse tool call arguments:", argsString);
          throw new Error(
            `Invalid arguments returned from LLM for tool ${name}`,
          );
        }

        const payload = { 
          ...args, 
          toolCallId: toolCall.id || `call_${Math.random().toString(36).substring(2, 9)}`,
          chatId,
          task: task.payload?.task || args.task
        };
        await queueTask(name, payload);

        if (!llmRes.content) {
          await sendSafeMessage(chatId, getFriendlyActionMessage(name, targetFirstName, args));
        }
      }
    } else if (llmRes.content) {
      await sendSafeMessage(chatId, llmRes.content);
      await saveMessage(chatId, "assistant", llmRes.content);
    }
  } catch (err) {
    console.error("Agent completion iteration error:", err);
    await sendSafeMessage(
      chatId,
      `Oh no, I ran into a little trouble: ${err.message || err}. Let's try that again!`,
    );
  }
}

export function shutdownBot() {
  if (bot) {
    bot.stop("SIGINT");
  }
}
