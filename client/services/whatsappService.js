import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { runPowerShellScript } from '../utils/osHelper.js';
import { config } from '../config/env.js';
import sharp from 'sharp';

const scriptPath = path.resolve('services/whatsapp_driver.ps1');

async function analyzeUiImage(base64Image, prompt) {
  const headers = {
    'x-client-secret': config.CLIENT_SECRET,
    'Content-Type': 'application/json'
  };
  const res = await axios.post(`${config.CLOUD_URL}/client/analyze-image`, { base64Image, prompt }, { headers });
  return res.data?.analysis || '';
}

export async function ensureOpen() {
  return await runPowerShellScript(scriptPath, { action: 'ensure_open' });
}

// Searches the contact and returns the base64 screenshot of the search results list prior to clicking
export async function searchContact(contactName) {
  const result = await runPowerShellScript(scriptPath, { action: 'search_contact', contactName });
  const pathLine = result.split('\n').find(line => line.trim().startsWith('path:'));
  if (!pathLine) {
    throw new Error('Could not find search screenshot path in driver output.');
  }
  
  const imgPath = pathLine.replace('path:', '').trim();
  if (!fs.existsSync(imgPath)) {
    throw new Error(`Search screenshot file does not exist at: ${imgPath}`);
  }

  const rawBase64 = fs.readFileSync(imgPath, 'base64');
  
  try {
    await fs.promises.unlink(imgPath);
  } catch (err) {
    console.error(`Failed to delete temporary search screenshot at ${imgPath}:`, err.message);
  }

  const compressedBuffer = await sharp(Buffer.from(rawBase64, 'base64'))
    .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 60 })
    .toBuffer();

  return compressedBuffer.toString('base64');
}

// Clicks the first search result card to open the conversation
export async function selectContact() {
  return await runPowerShellScript(scriptPath, { action: 'select_contact' });
}

export async function sendText(recipient, message) {
  // 1. Search contact and capture the search results screen
  const searchScreenshot = await searchContact(recipient);

  // 2. Perform vision-based check for multiple search matches
  try {
    const prompt = `Inspect the search results panel on the left of this WhatsApp window. We searched for the contact "${recipient}". 
Focus ONLY on the 'Chats' or 'Contacts' section at the top of the results list. Ignore any 'Messages' or 'Message History' section at the bottom.
Are there multiple different, distinct matching people or groups listed under the 'Chats' / 'Contacts' section?
Respond with 'yes' if there are multiple different contacts shown under the Chats/Contacts list.
Respond with 'no' if there is only one contact card (or no results at all) in that section.
Start your response with either 'yes' or 'no'.`;

    console.log(`Checking for multiple matches for "${recipient}" using Vision LLM...`);
    const analysis = await analyzeUiImage(searchScreenshot, prompt);
    const resultText = analysis.trim().toLowerCase();
    console.log(`Vision match verification output: "${analysis}"`);

    const isMultiple = resultText.startsWith('yes') || resultText.startsWith('true');
    if (isMultiple) {
      throw new Error(`Multiple matching contacts found: ${analysis}. Please be more specific (e.g. "Subhodeep Samanta" or "Subhodeep Work").`);
    }
  } catch (err) {
    if (err.message.includes('Multiple matching contacts')) {
      throw err;
    }
    console.warn('Vision verification check bypassed:', err.message);
  }

  // 3. Select the contact and send the text message
  await selectContact();
  return await runPowerShellScript(scriptPath, { action: 'send_text', message });
}

async function captureScreenshotBase64() {
  const result = await runPowerShellScript(scriptPath, { action: 'screenshot' });
  const pathLine = result.split('\n').find(line => line.trim().startsWith('path:'));
  if (!pathLine) {
    throw new Error('Could not find screenshot path in driver output.');
  }
  
  const imgPath = pathLine.replace('path:', '').trim();
  if (!fs.existsSync(imgPath)) {
    throw new Error(`Screenshot file does not exist at: ${imgPath}`);
  }

  const rawBase64 = fs.readFileSync(imgPath, 'base64');
  
  try {
    await fs.promises.unlink(imgPath);
  } catch (err) {
    console.error(`Failed to delete temporary screenshot at ${imgPath}:`, err.message);
  }

  const compressedBuffer = await sharp(Buffer.from(rawBase64, 'base64'))
    .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 60 })
    .toBuffer();

  return compressedBuffer.toString('base64');
}

export async function checkStatuses() {
  await ensureOpen();
  await runPowerShellScript(scriptPath, { action: 'status_tab' });
  return await captureScreenshotBase64();
}

export async function readLastConversation(recipient) {
  await searchContact(recipient);
  await selectContact();
  return await captureScreenshotBase64();
}

export async function clickAndCapture(clickX, clickY) {
  await runPowerShellScript(scriptPath, { action: 'click', clickX, clickY });
  await new Promise(resolve => setTimeout(resolve, 800));
  return await captureScreenshotBase64();
}
