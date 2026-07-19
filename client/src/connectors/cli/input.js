import readline from "readline";
import { renderMenu, clearMenu, colors as C } from "./menu.js";

const PROMPT = `${C.bold}${C.cyan}kairos${C.reset} ${C.dim}›${C.reset} `;

export function createInput({ onSubmit, onSuggest }) {
  const out = process.stdout;
  const input = process.stdin;

  readline.emitKeypressEvents(input);
  if (input.isTTY) input.setRawMode(true);

  let buffer = "";
  let cursor = 0;
  let menu = { items: [], selected: 0, lines: 0, open: false, kind: null };
  let locked = false;

  function redrawLine() {
    out.write("\r\x1b[2K");
    out.write(PROMPT + buffer);
    const back = buffer.length - cursor;
    if (back > 0) out.write(`\x1b[${back}D`);
  }

  function closeMenu() {
    if (menu.lines) {
      const back = buffer.length - cursor;
      if (back > 0) out.write(`\x1b[${back}C`);
      clearMenu(out, menu.lines);
    }
    menu = { items: [], selected: 0, lines: 0, open: false, kind: null };
    redrawLine();
  }

  function openMenu(suggestions) {
    if (menu.lines) closeMenu();
    if (!suggestions || !suggestions.items?.length) return;

    menu.items = suggestions.items.slice(0, 8);
    menu.kind = suggestions.kind;
    menu.selected = 0;
    menu.open = true;

    const back = buffer.length - cursor;
    if (back > 0) out.write(`\x1b[${back}C`);
    menu.lines = renderMenu(out, menu.items, menu.selected);
    out.write(`\x1b[${menu.lines}A`);
    redrawLine();
  }

  function refreshMenu() {
    if (!menu.open) return;
    const back = buffer.length - cursor;
    if (back > 0) out.write(`\x1b[${back}C`);
    clearMenu(out, menu.lines);
    menu.lines = renderMenu(out, menu.items, menu.selected);
    out.write(`\x1b[${menu.lines}A`);
    redrawLine();
  }

  function applySelection() {
    const item = menu.items[menu.selected];
    if (!item) return;
    if (menu.kind === "command") {
      buffer = item.value + " ";
    } else {
      const head = buffer.trimStart().split(/\s+/)[0];
      buffer = `${head} ${item.value}`;
    }
    cursor = buffer.length;
    closeMenu();
    maybeSuggest();
  }

  function maybeSuggest() {
    if (buffer.startsWith("/")) onSuggest(buffer);
    else if (menu.open) closeMenu();
  }

  input.on("keypress", (str, key) => {
    if (!key) return;

    if (key.ctrl && key.name === "c") {
      out.write("\n");
      process.exit(0);
    }

    if (locked) return;

    if (menu.open) {
      if (key.name === "up") { menu.selected = (menu.selected - 1 + menu.items.length) % menu.items.length; refreshMenu(); return; }
      if (key.name === "down") { menu.selected = (menu.selected + 1) % menu.items.length; refreshMenu(); return; }
      if (key.name === "tab") { applySelection(); return; }
      if (key.name === "escape") { closeMenu(); return; }
      if (key.name === "return") {
        const item = menu.items[menu.selected];
        const typedExact = menu.items.length === 1 || buffer.trim() === item?.value || buffer.trim().endsWith(item?.value);
        if (!typedExact && menu.kind === "value") { applySelection(); return; }
        if (!typedExact && menu.kind === "command" && buffer.trim() !== item?.value) { applySelection(); return; }
        closeMenu();
      }
    }

    if (key.name === "return") {
      const text = buffer.trim();
      out.write("\n");
      buffer = "";
      cursor = 0;
      if (!text) { redrawLine(); return; }
      locked = true;
      onSubmit(text);
      return;
    }

    if (key.name === "backspace") {
      if (cursor > 0) {
        buffer = buffer.slice(0, cursor - 1) + buffer.slice(cursor);
        cursor--;
        redrawLine();
        maybeSuggest();
      }
      return;
    }

    if (key.name === "left") { if (cursor > 0) { cursor--; redrawLine(); } return; }
    if (key.name === "right") { if (cursor < buffer.length) { cursor++; redrawLine(); } return; }

    if (str && !key.ctrl && !key.meta && str >= " ") {
      buffer = buffer.slice(0, cursor) + str + buffer.slice(cursor);
      cursor += str.length;
      redrawLine();
      maybeSuggest();
    }
  });

  return {
    showSuggestions(suggestions) {
      if (!buffer.startsWith("/")) return;
      openMenu(suggestions);
    },
    prompt() {
      locked = false;
      redrawLine();
    },
    unlock() {
      locked = false;
    },
    write(text) {
      if (menu.lines) closeMenu();
      out.write("\r\x1b[2K" + text + "\n");
    }
  };
}
