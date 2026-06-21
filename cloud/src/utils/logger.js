const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLogLevel = (process.env.LOG_LEVEL || "INFO").toUpperCase();
const currentLevelValue = LOG_LEVELS[currentLogLevel] !== undefined ? LOG_LEVELS[currentLogLevel] : LOG_LEVELS.INFO;

export function isDebug() {
  return currentLevelValue >= LOG_LEVELS.DEBUG || process.env.DEBUG_MODE === "true";
}

export function error(...args) {
  if (currentLevelValue >= LOG_LEVELS.ERROR) {
    console.error(...args);
  }
}

export function warn(...args) {
  if (currentLevelValue >= LOG_LEVELS.WARN) {
    console.warn(...args);
  }
}

export function info(...args) {
  if (currentLevelValue >= LOG_LEVELS.INFO) {
    console.log(...args);
  }
}

export function debug(...args) {
  if (currentLevelValue >= LOG_LEVELS.DEBUG || process.env.DEBUG_MODE === "true") {
    console.log(...args);
  }
}

export const log = info;
export default {
  error,
  warn,
  info,
  debug,
  log,
  isDebug
};