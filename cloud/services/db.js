import mongoose from 'mongoose';
import { config } from '../config/env.js';

export async function connectDB() {
  if (!config.MONGODB_URI) {
    console.warn('WARNING: MONGODB_URI is not defined. Database features will be mock/local-only.');
    return false;
  }

  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB successfully.');
    return true;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    return false;
  }
}

export function isConnected() {
  return mongoose.connection.readyState === 1;
}
