export const commands = {
  "/help": (rl) => {
    console.log("\nCommands:");
    console.log("  /help   - Show this help message");
    console.log("  /clear  - Clear console screen");
    console.log("  /exit   - Exit Kairos console");
    console.log("  /status - Check current status (stub)");
    console.log("  /tasks  - List active tasks (stub)");
    console.log("  /stop   - Stop current execution (stub)\n");
  },
  "/clear": (rl) => {
    console.clear();
  },
  "/exit": (rl) => {
    rl.close();
    process.exit(0);
  },
  "/status": () => {
    console.log("\nKairos: status check not implemented yet.\n");
  },
  "/tasks": () => {
    console.log("\nKairos: active task listing not implemented yet.\n");
  },
  "/stop": () => {
    console.log("\nKairos: execution cancellation not implemented yet.\n");
  }
};

export function handleCommand(input, rl) {
  const trimmed = input.trim();
  if (commands[trimmed]) {
    commands[trimmed](rl);
    return true;
  }
  return false;
}
