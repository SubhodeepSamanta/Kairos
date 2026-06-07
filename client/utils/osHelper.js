import { spawn } from 'child_process';
import fs from 'fs';
import { config } from '../config/env.js';

export function safeSpawn(binary, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const spawnOpts = {
      shell: false,
      windowsHide: true,
      ...options
    };

    console.log(`Spawning safely: ${binary} ${args.join(' ')}`);

    const proc = spawn(binary, args, spawnOpts);
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
      if (code === 0) {
        resolve(stdout.trim() || stderr.trim() || 'Success');
      } else {
        reject(new Error(stderr.trim() || stdout.trim() || `Process exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
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

export function openBrowser(url, profileAlias = '') {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  if (profileAlias && fs.existsSync(chromePath)) {
    const profileDir = config.CHROME_PROFILES?.[profileAlias.toLowerCase()] || profileAlias;
    console.log(`Opening URL in Chrome Profile: ${profileDir}`);
    return safeSpawn(chromePath, [`--profile-directory=${profileDir}`, url]);
  }
  
  return safeSpawn('cmd.exe', ['/c', 'start', '', url], { shell: true });
}
