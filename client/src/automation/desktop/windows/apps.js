import { spawn } from "child_process";
import fs from "fs";
import { exec } from "child_process";

const APP_COMMANDS = {
  notepad: ["notepad.exe"],

  calculator: ["calc.exe"],

  chrome: [
    "chrome.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ]
};

export async function openApp(app) {
  const commands = APP_COMMANDS[app.toLowerCase()];

  if (!commands) {
    throw new Error(`Unsupported app: ${app}`);
  }

  for (const command of commands) {
    try {
      if (
        command.includes(":\\") &&
        !fs.existsSync(command)
      ) {
        continue;
      }

      await new Promise((resolve, reject) => {
        const child = spawn(command, [], {
          detached: true,
          stdio: "ignore"
        });

        child.once("error", reject);

        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });

      return {
        success: true,
        app
      };
    } catch {
      continue;
    }
  }

  throw new Error(
    `Could not launch ${app}`
  );
}

export function isAppRunning(app) {
  const PROCESS_NAMES = {
    notepad: "notepad.exe",
    calculator: "CalculatorApp.exe",
    chrome: "chrome.exe"
  };

  const processName = PROCESS_NAMES[app];

  if (!processName) {
    throw new Error(
      `Unsupported app: ${app}`
    );
  }

  return new Promise((resolve, reject) => {
    exec(
      `tasklist /FI "IMAGENAME eq ${processName}"`,
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(
          stdout
            .toLowerCase()
            .includes(processName.toLowerCase())
        );
      }
    );
  });
}