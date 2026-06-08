import fs from 'fs';
import path from 'path';
import { isPathSafe, isCommandSafe } from '../utils/security.js';
import { safeSpawn } from '../utils/osHelper.js';

export async function openFolder(folderPath, editor = 'explorer') {
  if (!folderPath) throw new Error('No folder path specified.');

  let resolvedPath = folderPath;

  if (folderPath.toLowerCase() === 'biggest g') {
    resolvedPath = resolveSpecialFolder();
  }

  const absolutePath = path.resolve(resolvedPath);

  if (!isPathSafe(absolutePath)) {
    throw new Error(`Access Denied: Path "${absolutePath}" is not within whitelisted directories.`);
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Directory does not exist: ${absolutePath}`);
  }

  if (editor === 'vscode') {
    await safeSpawn('code', [absolutePath]);
    return `Opened folder "${absolutePath}" in VS Code.`;
  } else {
    await safeSpawn('explorer.exe', [absolutePath]);
    return `Opened folder "${absolutePath}" in File Explorer.`;
  }
}

export async function runCommand(command) {
  if (!command) throw new Error('No command content provided.');

  if (!isCommandSafe(command)) {
    throw new Error(`Execution Blocked: Command "${command}" contains unsafe operations.`);
  }

  const tokens = command.trim().split(/\s+/);
  const binary = tokens[0];
  const args = tokens.slice(1);

  return await safeSpawn(binary, args, { shell: true });
}

function resolveSpecialFolder() {
  const desktopPath = path.join(process.env.USERPROFILE || 'C:\\', 'Desktop');
  try {
    if (fs.existsSync(desktopPath)) {
      const items = fs.readdirSync(desktopPath);
      for (const item of items) {
        const fullPath = path.join(desktopPath, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && item.toLowerCase().startsWith('g')) {
          return fullPath;
        }
      }
    }
  } catch (e) {
    console.error('Error scanning desktop for special folder:', e.message);
  }
  return desktopPath;
}

export async function manageApplication(appName, action) {
  if (!appName) throw new Error('No application name specified.');
  if (!action) throw new Error('No action specified.');

  const normalizedApp = appName.toLowerCase().trim();
  const normalizedAction = action.toLowerCase().trim();

  console.log(`Managing application: ${normalizedApp} (${normalizedAction})`);

  if (normalizedAction === 'open') {
    if (normalizedApp === 'whatsapp') {
      await safeSpawn('cmd.exe', ['/c', 'start', 'whatsapp:']);
      return 'Successfully opened WhatsApp.';
    } else if (normalizedApp === 'spotify') {
      await safeSpawn('cmd.exe', ['/c', 'start', 'spotify:']);
      return 'Successfully opened Spotify.';
    } else if (normalizedApp === 'chrome') {
      await safeSpawn('cmd.exe', ['/c', 'start', 'chrome']);
      return 'Successfully opened Chrome.';
    } else if (normalizedApp === 'vscode') {
      await safeSpawn('cmd.exe', ['/c', 'code']);
      return 'Successfully opened VS Code.';
    } else {
      try {
        await safeSpawn('cmd.exe', ['/c', 'start', normalizedApp]);
        return `Attempted to open ${appName}.`;
      } catch (err) {
        throw new Error(`Failed to open application "${appName}": ${err.message}`);
      }
    }
  } else if (normalizedAction === 'close') {
    let processPattern = '';
    if (normalizedApp === 'whatsapp') {
      processPattern = 'WhatsApp*';
    } else if (normalizedApp === 'spotify') {
      processPattern = 'Spotify*';
    } else if (normalizedApp === 'chrome') {
      processPattern = 'chrome';
    } else if (normalizedApp === 'vscode') {
      processPattern = 'code';
    } else {
      processPattern = `${normalizedApp}*`;
    }

    try {
      await safeSpawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Stop-Process -Name "${processPattern}" -Force -ErrorAction SilentlyContinue`
      ]);
      return `Successfully closed ${appName}.`;
    } catch (err) {
      throw new Error(`Failed to close application "${appName}": ${err.message}`);
    }
  } else {
    throw new Error(`Unknown action: ${action}`);
  }
}

