import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  CLOUD_URL: process.env.CLOUD_URL || 'http://localhost:3000',
  CLIENT_SECRET: process.env.CLIENT_SECRET || 'my-super-secret-kairos-token',
  POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL || '3000', 10),
  
  PATH_WHITELIST: [
    path.resolve('c:/Users/USER/Desktop/Kairos'),
    path.resolve('c:/Users/USER/Desktop')
  ],

  CHROME_PROFILES: {
    personal: 'Default',
    work: 'Profile 1',
    leetcode: 'Profile 8'
  }
};
