import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  CLOUD_URL: process.env.CLOUD_URL || 'http://localhost:3000',
  CLIENT_SECRET: process.env.CLIENT_SECRET || 'my-super-secret-kairos-token',
  POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL || '3000', 10),
  
  PATH_WHITELIST: [
    path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop'),
    path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents'),
    path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads'),
    path.join(process.env.USERPROFILE || process.env.HOME || '', 'Projects'),
  ],

  CHROME_PROFILES: {
    personal: 'Default',
    work: 'Profile 1',
    leetcode: 'Profile 8'
  },

  CHROME_PROFILE_ORDER: (process.env.CHROME_PROFILE_ORDER || 'Default').split(',').map(s => s.trim())
};
