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
