import fs from "fs";
import path from "path";

const MAX_ENTRIES = 50;
const persisting = process.env.NODE_ENV !== "test";
const file = () => path.join(process.cwd(), "data", "console-history.json");

export function createHistory({ load = true } = {}) {
  let items = [];
  let index = -1;
  let draft = "";

  if (load && persisting) {
    try {
      const raw = JSON.parse(fs.readFileSync(file(), "utf8"));
      if (Array.isArray(raw)) items = raw.filter(x => typeof x === "string").slice(-MAX_ENTRIES);
    } catch {}
  }

  const save = () => {
    if (!persisting) return;
    try {
      fs.mkdirSync(path.dirname(file()), { recursive: true });
      fs.writeFileSync(file(), JSON.stringify(items), "utf8");
    } catch {}
  };

  return {
    add(text) {
      const clean = String(text || "").trim();
      index = -1;
      if (!clean) return;
      if (items[items.length - 1] === clean) return;
      items.push(clean);
      if (items.length > MAX_ENTRIES) items.shift();
      save();
    },

    up(current) {
      if (!items.length || index >= items.length - 1) return null;
      if (index === -1) draft = String(current ?? "");
      index++;
      return items[items.length - 1 - index];
    },

    down() {
      if (index === -1) return null;
      index--;
      return index === -1 ? draft : items[items.length - 1 - index];
    },

    resetCursor() {
      index = -1;
    },

    size: () => items.length
  };
}
