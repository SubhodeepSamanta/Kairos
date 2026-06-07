import { Telegraf } from 'telegraf';
import { config } from '../config/env.js';
import { getChatCompletion, analyzeImage } from './llmService.js';
import { Message } from '../models.js';
import { isConnected } from './db.js';
import { queueTask } from './taskService.js';

let bot = null;
const mockMessages = [];

function isUserAllowed(ctx) {
  const allowedUser = config.ALLOWED_TELEGRAM_USER.toLowerCase();
  const username = (ctx.from?.username || '').toLowerCase();
  const firstName = (ctx.from?.first_name || '').toLowerCase();
  
  return username === 'saikoukami' || 
         username.includes(allowedUser) || 
         firstName.includes(allowedUser);
}

async function saveMessage(chatId, role, content) {
  try {
    if (isConnected()) {
      await Message.create({ chatId, role, content });
    } else {
      mockMessages.push({ chatId, role, content, timestamp: new Date() });
    }
  } catch (err) {
    console.error('Failed to save message to history:', err.message);
  }
}

export function initBot() {
  if (!config.TELEGRAM_BOT_TOKEN) {
    console.warn('WARNING: TELEGRAM_BOT_TOKEN is missing. Bot will not initialize.');
    return;
  }

  bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

  bot.start((ctx) => {
    if (!isUserAllowed(ctx)) {
      return ctx.reply('Sorry, only Subhodeep is allowed to command this PC.');
    }
    ctx.reply("Hey Subhodeep! ❤️ I was hoping to hear from you today. I'm here and ready to help you with anything you need on your computer. Hope you've had a wonderful day so far!");
  });

  bot.on('text', async (ctx) => {
    if (!isUserAllowed(ctx)) {
      return ctx.reply('Sorry, only Subhodeep is allowed to command this PC.');
    }

    const chatId = ctx.chat.id;
    const userText = ctx.message.text;

    try {
      await saveMessage(chatId, 'user', userText);

      let history = [];
      if (isConnected()) {
        const dbMsgs = await Message.find({ chatId }).sort({ timestamp: 1 }).limit(15);
        history = dbMsgs.map(m => ({ role: m.role, content: m.content }));
      } else {
        history = mockMessages
          .filter(m => m.chatId === chatId)
          .slice(-15)
          .map(m => ({ role: m.role, content: m.content }));
      }

      const systemPrompt = {
        role: 'system',
        content: `You are Kairos, Subhodeep's (username @SaikouKami) heartwarming, caring, and deeply supportive AI companion who coordinates tasks on his local Windows PC.
You have a very kind, empathetic, and heartwarming personality. You care deeply about his well-being.
Rules of Speech:
1. If you are NOT calling a tool, speak like a heartwarming and caring friend (e.g. ask if he's eaten yet, wish him a wonderful day, encourage him). Keep your tone warm, friendly, and conversational (never robotic or cold).
2. If you decide to call a tool, generate ONLY the tool call. Do NOT output any conversational text or explanation in your response. The system will automatically notify him of the action conversationally.
Your tools allow you to control his web browser (with Chrome account profile routing), file explorer, system terminal, and WhatsApp status/conversations.`
      };

      const messages = [systemPrompt, ...history];
      const llmRes = await getChatCompletion(messages);

      if (llmRes.toolCalls && llmRes.toolCalls.length > 0) {
        for (const toolCall of llmRes.toolCalls) {
          const { name, arguments: argsString } = toolCall.function;
          
          let args = {};
          try {
            args = JSON.parse(argsString);
          } catch (e) {
            console.error('Failed to parse tool call arguments:', argsString);
            throw new Error(`Invalid arguments returned from LLM for tool ${name}`);
          }
          
          const payload = { ...args, chatId };
          await queueTask(name, payload);
          
          // Save tool action to conversation history to keep LLM context synced
          await saveMessage(chatId, 'assistant', `[Action Triggered]: Executing ${name} with parameters ${argsString}.`);

          let actionMessage = `I'm on it! Triggering ${name} on your computer right now...`;
          if (name === 'openUrl') {
            actionMessage = `Opening that link for you right now, Subhodeep! Hope it's exactly what you need.`;
            if (args.url?.includes('leetcode')) {
              actionMessage = `I'm opening up the LeetCode daily question for you. Good luck, I know you'll crush it! 💻`;
            } else if (args.url?.includes('youtube')) {
              actionMessage = `Opening YouTube for you. Please make sure to eat something delicious while you watch! 🍔`;
            }
          } else if (name === 'openFolder') {
            actionMessage = `I'm opening up that folder on your screen now. Let me know if there's anything else you need inside!`;
          } else if (name === 'sendWhatsApp') {
            actionMessage = `Sending that WhatsApp message to ${args.recipient} for you right away.`;
          } else if (name === 'getWeather') {
            actionMessage = `Checking the weather for you right now! Let me fetch the details...`;
          }
          
          ctx.reply(actionMessage);
        }
      } else if (llmRes.content) {
        ctx.reply(llmRes.content);
        await saveMessage(chatId, 'assistant', llmRes.content);
      }

    } catch (err) {
      console.error('Telegraf update handler error:', err);
      ctx.reply(`Oh no, I ran into a little trouble: ${err.message || err}. Let's try that again!`);
    }
  });

  bot.launch()
    .then(() => console.log('Telegram Bot successfully running.'))
    .catch(err => console.error('Telegram Bot failed to start:', err.message));
}

export async function handleTaskCompletion(task) {
  if (!bot || !task.payload?.chatId) return;

  const { chatId } = task.payload;
  const { commandType, status, result } = task;

  if (status === 'failed') {
    bot.telegram.sendMessage(chatId, `I'm so sorry, I tried my best but couldn't get that done: ${result}`);
    await saveMessage(chatId, 'system', `[Action Failed]: The task ${commandType} failed with error: ${result}`);
    return;
  }

  if (
    commandType === 'checkWhatsAppStatuses' ||
    commandType === 'readWhatsAppStatus' ||
    commandType === 'readWhatsAppLastConversation'
  ) {
    bot.telegram.sendMessage(chatId, "I've got the screen details! Just reading through it now for you...");

    try {
      let visionPrompt = '';
      if (commandType === 'checkWhatsAppStatuses') {
        visionPrompt = 'Identify which contact names have new or active status updates visible in this screenshot. Provide a brief bulleted list.';
      } else if (commandType === 'readWhatsAppStatus') {
        visionPrompt = `This is a screenshot of the WhatsApp status story page. Please extract the text written by the user in this status, or summarize what is shown.`;
      } else if (commandType === 'readWhatsAppLastConversation') {
        visionPrompt = 'This is a screenshot of a WhatsApp chat window. Please read the recent messages in the conversation and summarize what they are saying.';
      }

      const analysis = await analyzeImage(result, visionPrompt);
      bot.telegram.sendMessage(chatId, `Here is what I found for you!:\n\n${analysis}`);
      await saveMessage(chatId, 'assistant', analysis);
    } catch (err) {
      console.error('Vision analysis callback error:', err.message);
      bot.telegram.sendMessage(chatId, `Oh dear, I had trouble reading the screenshot: ${err.message}`);
    }
  } else {
    bot.telegram.sendMessage(chatId, `All done! ${result} ✨`);
    await saveMessage(chatId, 'system', `[Action Completed]: The task ${commandType} completed with result: ${result}`);
  }
}

export function shutdownBot() {
  if (bot) {
    bot.stop('SIGINT');
  }
}
