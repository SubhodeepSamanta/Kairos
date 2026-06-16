import readline from "readline";

export function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

export function showPrompt(rl, callback) {
  rl.question("\x1b[1m\x1b[32mKairos>\x1b[0m ", callback);
}

export function printMessage(sender, text, isError = false) {
  const color = isError ? "\x1b[1m\x1b[31m" : "\x1b[1m\x1b[36m";
  console.log(`\n${color}${sender}:\x1b[0m\n${text}\n`);
}
