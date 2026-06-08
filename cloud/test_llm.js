import { getChatCompletion } from './services/llmService.js';
import mongoose from 'mongoose';
import { connectDB } from './services/db.js';

async function test() {
  await connectDB();
  console.log("Testing chat completion...");
  try {
    const res = await getChatCompletion([
      { role: 'user', content: 'capture my screen' }
    ]);
    console.log("LLM response:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("LLM Error:", err.message);
  }
}
test();
