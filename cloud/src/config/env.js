import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: process.env.PORT,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  CLIENT_SECRET: process.env.CLIENT_SECRET
};