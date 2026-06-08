import dotenv from "dotenv";

dotenv.config();

export const env = {
  CLOUD_URL: process.env.CLOUD_URL,
  CLIENT_SECRET: process.env.CLIENT_SECRET
};