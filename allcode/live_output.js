/**
 * Live Output — Pure Cloud Log Monitor
 * 
 * This script does NOT start, stop, or affect the cloud server in any way.
 * It simply watches the log file written by cloud_logger.js and mirrors
 * everything to docs/output.md in real-time.
 * 
 * Usage:
 *   1. Start cloud normally:  cd cloud && npm start
 *   2. In another terminal:   cd allcode && node live_output.js
 * 
 * The monitor will run forever, tailing new log entries as they appear.
 * Press Ctrl+C to stop the monitor (server keeps running).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, "cloud_server.log");
const docsDir = path.join(__dirname, "..", "docs");
const OUTPUT_FILE = path.join(docsDir, "output.md");

// ── Helpers ──────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── Output Writer ────────────────────────────────────────────────────────

ensureDir(docsDir);

function freshOutput() {
  fs.writeFileSync(
    OUTPUT_FILE,
    `# Kairos Cloud – Live Output\n\n> Monitor started at ${timestamp()}\n\n\`\`\`\n`,
    "utf8"
  );
}

function appendOutput(text) {
  try {
    // Cap at 500 KB — rotate
    const stats = fs.statSync(OUTPUT_FILE);
    if (stats.size > 500_000) {
      freshOutput();
      fs.appendFileSync(OUTPUT_FILE, `[LOG ROTATED at ${timestamp()}]\n`, "utf8");
    }
  } catch {
    freshOutput();
  }

  try {
    fs.appendFileSync(OUTPUT_FILE, text, "utf8");
  } catch {
    // Ignore
  }
}

// ── Log Tailer ───────────────────────────────────────────────────────────

let lastSize = 0;
let watchReady = false;

function readNewContent() {
  try {
    const stats = fs.statSync(LOG_FILE);
    const currentSize = stats.size;

    if (currentSize < lastSize) {
      // File was truncated (server restarted) — reset
      lastSize = 0;
      appendOutput(`\n--- [Server Restarted at ${timestamp()}] ---\n\n`);
    }

    if (currentSize > lastSize) {
      // Read only the new bytes
      const fd = fs.openSync(LOG_FILE, "r");
      const buffer = Buffer.alloc(currentSize - lastSize);
      fs.readSync(fd, buffer, 0, buffer.length, lastSize);
      fs.closeSync(fd);

      const newText = buffer.toString("utf8");
      process.stdout.write(newText); // Mirror to terminal
      appendOutput(newText);         // Write to docs/output.md

      lastSize = currentSize;
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      // Log file doesn't exist yet — server hasn't started
      if (!watchReady) {
        console.log(`[Monitor] Waiting for cloud server to start (looking for ${path.basename(LOG_FILE)})...`);
        watchReady = true;
      }
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

freshOutput();

console.log(`[Monitor] Pure cloud log monitor — does NOT start/stop the server`);
console.log(`[Monitor] Log source: ${LOG_FILE}`);
console.log(`[Monitor] Output:     ${OUTPUT_FILE}`);
console.log(`[Monitor] Press Ctrl+C to stop.\n`);

// Initial read
readNewContent();

// Watch for changes using fs.watchFile (works reliably on Windows for appending files)
fs.watchFile(LOG_FILE, { interval: 500 }, () => {
  readNewContent();
});

// Also poll every 2 seconds as a fallback (fs.watchFile can miss rapid appends)
const pollInterval = setInterval(readNewContent, 2000);

// ── Graceful Shutdown ────────────────────────────────────────────────────

function shutdown() {
  console.log(`\n[Monitor] Stopped at ${timestamp()}`);
  appendOutput(`\n[Monitor] Stopped at ${timestamp()}\n`);
  fs.unwatchFile(LOG_FILE);
  clearInterval(pollInterval);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
