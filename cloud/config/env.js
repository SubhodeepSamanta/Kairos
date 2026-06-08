import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || '',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  GROQ_VISION_MODEL: process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-instruct',
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY || '',
  NVIDIA_MODEL: process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct',
  NVIDIA_VISION_MODEL: process.env.NVIDIA_VISION_MODEL || 'llama-3.2-90b-vision-instruct',
  GOOGLE_AI_KEY: process.env.GOOGLE_AI_KEY || '',
  GOOGLE_MODEL: process.env.GOOGLE_MODEL || 'gemini-2.0-flash',
  CLIENT_SECRET: process.env.CLIENT_SECRET || 'my-super-secret-kairos-token',
  ALLOWED_TELEGRAM_USER: process.env.ALLOWED_TELEGRAM_USER || 'subhodeep'
};

if (!config.TELEGRAM_BOT_TOKEN) {
  console.warn('WARNING: TELEGRAM_BOT_TOKEN is missing in environment!');
}
if (!config.OPENROUTER_API_KEY && !config.GROQ_API_KEY) {
  console.warn('WARNING: No LLM API key provided (OpenRouter or Groq)! Agent will operate in mock mode.');
}
