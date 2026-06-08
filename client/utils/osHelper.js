import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import { clientState } from './clientState.js';

export function safeSpawn(binary, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    if (clientState.isCancelled) {
      return reject(new Error('Task was cancelled.'));
    }

    const spawnOpts = {
      shell: false,
      windowsHide: true,
      ...options
    };

    console.log(`Spawning safely: ${binary} ${args.join(' ')}`);

    const proc = spawn(binary, args, spawnOpts);
    clientState.activeProcess = proc;

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    proc.on('close', (code) => {
      if (clientState.activeProcess === proc) {
        clientState.activeProcess = null;
      }
      if (code === 0) {
        resolve(stdout.trim() || stderr.trim() || 'Success');
      } else {
        reject(new Error(stderr.trim() || stdout.trim() || `Process exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      if (clientState.activeProcess === proc) {
        clientState.activeProcess = null;
      }
      reject(err);
    });
  });
}

export function runPowerShellScript(scriptPath, namedArgs = {}) {
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath
  ];

  for (const [key, val] of Object.entries(namedArgs)) {
    if (val !== undefined && val !== null) {
      args.push(`-${key}`, String(val));
    }
  }

  return safeSpawn('powershell.exe', args);
}

export function resolveChromeProfile(alias) {
  const localStatePath = path.join(
    process.env.USERPROFILE || 'C:\\Users\\USER',
    'AppData\\Local\\Google\\Chrome\\User Data\\Local State'
  );

  let infoCache = {};
  if (fs.existsSync(localStatePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
      infoCache = data.profile?.info_cache || {};
    } catch (err) {
      console.error('Failed to parse Chrome Local State:', err.message);
    }
  }

  const normalized = (alias || '').toLowerCase().trim();

  // Visual Picker Order from left-to-right, top-to-bottom:
  // 1st: Profile 8 (subhodeepsamanta2005@gmail.com / Kami)
  // 2nd: Profile 1 (subhoking75@gmail.com / Saikou Kami)
  // 3rd: Profile 4 (theonekingofthewholemultiverse@gmail.com / Subhodeep)
  // 4th: Profile 6 (subhodeepsamanta01@gmail.com / Subhodeep)
  // 5th: Default (saikoukami0001@gmail.com / UwU)
  // 6th: Profile 10 (sales@v10xai.com / v10xai.com)
  // 7th: Profile 2 (guest-like "Your Chrome", empty email)
  const visualOrder = [
    'Profile 8',
    'Profile 1',
    'Profile 4',
    'Profile 6',
    'Default',
    'Profile 10',
    'Profile 2'
  ];

  // Helper to match ordinal or number strings to visual index
  const getVisualIndex = (term) => {
    const cleanTerm = term
      .replace(/\b(account|profile|chrome|one|number|no|index)\b/g, '')
      .replace(/\s+/g, '')
      .trim();

    if (/^(1st|first|1)$/.test(cleanTerm)) return 0;
    if (/^(2nd|second|2)$/.test(cleanTerm)) return 1;
    if (/^(3rd|third|3)$/.test(cleanTerm)) return 2;
    if (/^(4th|fourth|4)$/.test(cleanTerm)) return 3;
    if (/^(5th|fifth|5)$/.test(cleanTerm)) return 4;
    if (/^(6th|sixth|6)$/.test(cleanTerm)) return 5;
    if (/^(7th|seventh|7)$/.test(cleanTerm)) return 6;

    return -1;
  };

  const visualIndex = getVisualIndex(normalized);
  if (visualIndex >= 0 && visualIndex < visualOrder.length) {
    const targetDir = visualOrder[visualIndex];
    if (infoCache[targetDir]) {
      return targetDir;
    }
  }

  // Check direct key match (e.g. "profile 1", "profile 10", "default")
  for (const dirName of Object.keys(infoCache)) {
    if (dirName.toLowerCase() === normalized) {
      return dirName;
    }
  }

  if (normalized) {
    // Clean search alias by stripping noise words
    let cleanQuery = normalized;
    const noiseRegex = /\b(account|profile|chrome|email|gmail|google|mailbox|address)\b/g;
    const stripped = normalized.replace(noiseRegex, '').replace(/\s+/g, '').trim();
    if (stripped.length > 0) {
      cleanQuery = stripped;
    }

    const sanitize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9@.]/g, '');
    const querySanitized = sanitize(cleanQuery);

    if (querySanitized.length > 0) {
      const scores = {};

      for (const [dirName, profileInfo] of Object.entries(infoCache)) {
        let score = 0;
        const email = sanitize(profileInfo.user_name);
        const gaiaName = sanitize(profileInfo.gaia_name);
        const name = sanitize(profileInfo.name);
        const shortcut = sanitize(profileInfo.shortcut_name);

        // Low priority for guest/Your Chrome profile unless explicitly requested
        if (dirName === 'Profile 2' && querySanitized !== 'yourchrome') {
          score -= 50;
        }

        // Exact matches
        if (email === querySanitized) score += 100;
        if (name === querySanitized) score += 90;
        if (gaiaName === querySanitized) score += 80;
        if (shortcut === querySanitized) score += 70;

        // Contains matches (min length to avoid tiny/meaningless matches)
        if (querySanitized.length >= 3) {
          if (email.includes(querySanitized)) score += 60;
          if (name.includes(querySanitized)) score += 50;
          if (gaiaName.includes(querySanitized)) score += 40;
          if (shortcut.includes(querySanitized)) score += 30;

          // Cross-contains
          if (querySanitized.includes(email) && email.length > 0) score += 20;
          if (querySanitized.includes(name) && name.length > 0) score += 15;
          if (querySanitized.includes(gaiaName) && gaiaName.length > 0) score += 10;
        }

        // Tie-breaker: prioritize Profile 8 as the primary user profile
        if (dirName === 'Profile 8') {
          score += 0.1;
        }

        if (score > 0) {
          scores[dirName] = score;
        }
      }

      let bestProfile = null;
      let bestScore = -Infinity;
      for (const [dirName, score] of Object.entries(scores)) {
        if (score > bestScore) {
          bestScore = score;
          bestProfile = dirName;
        }
      }

      if (bestProfile) {
        return bestProfile;
      }
    }
  }

  // Fallback to hardcoded mapping
  if (normalized && config.CHROME_PROFILES?.[normalized]) {
    return config.CHROME_PROFILES[normalized];
  }

  // Generic fallback: use primary profile, or any signed-in profile, or Default
  if (!alias || normalized === 'leetcode' || normalized === 'default' || normalized === 'personal') {
    if (infoCache['Profile 8']) return 'Profile 8';
    if (infoCache['Default']?.user_name) return 'Default';
    for (const [dirName, profileInfo] of Object.entries(infoCache)) {
      if (profileInfo.user_name) {
        return dirName;
      }
    }
  }

  return 'Default';
}

export function openBrowser(url, profileAlias = '') {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  const chromePath = paths.find(p => fs.existsSync(p));
  
  if (chromePath) {
    const profileDir = resolveChromeProfile(profileAlias);
    console.log(`Opening URL in Chrome Profile directory: ${profileDir}`);
    return safeSpawn(chromePath, [`--profile-directory=${profileDir}`, url]);
  }
  
  return safeSpawn('cmd.exe', ['/c', 'start', '', url], { shell: true });
}
