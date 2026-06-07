import fs from 'fs';
import path from 'path';
import { runPowerShellScript } from '../utils/osHelper.js';

const scriptPath = path.resolve('services/whatsapp_driver.ps1');

export async function ensureOpen() {
  return await runPowerShellScript(scriptPath, { action: 'ensure_open' });
}

export async function searchContact(contactName) {
  return await runPowerShellScript(scriptPath, { action: 'search_contact', contactName });
}

export async function sendText(recipient, message) {
  await searchContact(recipient);
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

  const base64Data = fs.readFileSync(imgPath, 'base64');
  
  try {
    fs.unlinkSync(imgPath);
  } catch (err) {
    console.error('Failed to delete temporary screenshot:', err.message);
  }

  return base64Data;
}

export async function checkStatuses() {
  await ensureOpen();
  await runPowerShellScript(scriptPath, { action: 'status_tab' });
  return await captureScreenshotBase64();
}

export async function readLastConversation(recipient) {
  await searchContact(recipient);
  return await captureScreenshotBase64();
}

export async function clickAndCapture(clickX, clickY) {
  await runPowerShellScript(scriptPath, { action: 'click', clickX, clickY });
  await new Promise(resolve => setTimeout(resolve, 800));
  return await captureScreenshotBase64();
}
