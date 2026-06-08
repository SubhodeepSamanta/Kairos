import crypto from 'crypto';
import { captureFullScreen } from '../services/utilityService.js';

export async function captureHash() {
  const base64 = await captureFullScreen();
  return {
    hash: crypto.createHash('md5').update(base64).digest('hex'),
    base64
  };
}

export async function verifyAction(beforeHash, taskDescription) {
  await new Promise(resolve => setTimeout(resolve, 800));
  const after = await captureHash();
  
  if (after.hash === beforeHash) {
    return { success: false, reason: 'Screen did not change after action' };
  }
  
  return { success: true, afterShot: after.base64 };
}
