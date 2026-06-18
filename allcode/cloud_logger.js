/**
 * Cloud Logger — Console Interceptor
 * 
 * Import this ONCE at the top of cloud/index.js.
 * It patches console.log / .error / .warn / .info to also
 * append every line to a shared log file that live_output.js can tail.
 * 
 * The server runs exactly the same — this only ADDS file logging.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, "cloud_server.log");

// Append start marker to log
fs.appendFileSync(LOG_FILE, `\n--- [KAIROS] Server started at ${new Date().toISOString()} ---\n`);

function appendToLog(level, args) {
  const timestamp = new Date().toISOString();
  const message = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
    .join(" ");
  const line = `[${timestamp}] [${level}] ${message}\n`;

  try {
    fs.appendFileSync(LOG_FILE, line, "utf8");
  } catch {
    // Silently ignore write errors — never crash the server
  }
}

// Patch console methods (keep originals working)
const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);
const originalWarn = console.warn.bind(console);
const originalInfo = console.info.bind(console);

console.log = (...args) => {
  originalLog(...args);
  appendToLog("LOG", args);
};

console.error = (...args) => {
  originalError(...args);
  appendToLog("ERROR", args);
};

console.warn = (...args) => {
  originalWarn(...args);
  appendToLog("WARN", args);
};

console.info = (...args) => {
  originalInfo(...args);
  appendToLog("INFO", args);
};

// Also capture uncaught exceptions / rejections
process.on("uncaughtException", (err) => {
  appendToLog("FATAL", [`Uncaught Exception: ${err.stack || err.message}`]);
});

process.on("unhandledRejection", (reason) => {
  appendToLog("FATAL", [`Unhandled Rejection: ${reason?.stack || reason}`]);
});
