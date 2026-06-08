import dotenv from "dotenv";

dotenv.config();

export const env = {
    PORT:
        process.env.PORT,

    TELEGRAM_BOT_TOKEN:
        process.env.TELEGRAM_BOT_TOKEN,

    OPENROUTER_API_KEY:
        process.env.OPENROUTER_API_KEY,

    DATABASE_URL:
        process.env.DATABASE_URL,

    GROQ_API_KEY:
        process.env.GROQ_API_KEY,

    NVIDIA_API_KEY:
        process.env.NVIDIA_API_KEY,

    CLIENT_SECRET:
        process.env.CLIENT_SECRET
};