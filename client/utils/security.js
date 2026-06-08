import path from 'path';
import { config } from '../config/env.js';

export function isPathSafe(targetPath) {
  if (!targetPath) return false;

  try {
    const resolvedTarget = path.resolve(targetPath);

    return config.PATH_WHITELIST.some(safePath => {
      const resolvedSafe = path.resolve(safePath);
      return resolvedTarget.startsWith(resolvedSafe);
    });
  } catch (err) {
    console.error('Path validation error:', err.message);
    return false;
  }
}

export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[;&|><`\$\r\n]/g, '').trim();
}

const FORBIDDEN_PATTERNS = [
  'rm ', 'del ', 'format ', 'mkfs', 'shutdown', 'reboot', 'attrib', 'takeown',
  'icacls', 'net user', 'reg ', 'sfc ', 'dism ', 'cipher'
];

export function isCommandSafe(cmd) {
  if (!cmd) return false;

  const cleanCmd = cmd.toLowerCase().trim();
  const isForbidden = FORBIDDEN_PATTERNS.some(pattern => cleanCmd.includes(pattern));
  if (isForbidden) return false;

  return true;
}

export function sanitizeUrl(urlStr) {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.href;
  } catch (e) {
    return '';
  }
}
