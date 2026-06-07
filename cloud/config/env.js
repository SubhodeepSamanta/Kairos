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
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY || '',
  CLIENT_SECRET: process.env.CLIENT_SECRET || 'my-super-secret-kairos-token',
  ALLOWED_TELEGRAM_USER: process.env.ALLOWED_TELEGRAM_USER || 'subhodeep'
};

if (!config.TELEGRAM_BOT_TOKEN) {
  console.warn('WARNING: TELEGRAM_BOT_TOKEN is missing in environment!');
}
if (!config.OPENROUTER_API_KEY && !config.GROQ_API_KEY) {
  console.warn('WARNING: No LLM API key provided (OpenRouter or Groq)! Agent will operate in mock mode.');
}
