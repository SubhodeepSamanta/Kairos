import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { createInput } from "../../src/connectors/cli/input.js";

function fakeTty() {
  const stdin = new EventEmitter();
  stdin.isTTY = true;
  stdin.setRawMode = vi.fn();
  stdin.resume = vi.fn();
  stdin.setEncoding = vi.fn();

  const written = [];
  const stdout = { write: (s) => { written.push(s); return true; }, columns: 100 };

  return { stdin, stdout, written, text: () => written.join("") };
}

function press(stdin, name, str = null) {
  stdin.emit("keypress", str, { name, ctrl: false, meta: false });
}

function type(stdin, text) {
  for (const ch of text) stdin.emit("keypress", ch, { name: ch, ctrl: false, meta: false });
}

let tty;
const realIn = process.stdin;
const realOut = process.stdout;

beforeEach(() => {
  tty = fakeTty();
  Object.defineProperty(process, "stdin", { value: tty.stdin, configurable: true });
  Object.defineProperty(process, "stdout", { value: tty.stdout, configurable: true });
});

function restore() {
  Object.defineProperty(process, "stdin", { value: realIn, configurable: true });
  Object.defineProperty(process, "stdout", { value: realOut, configurable: true });
}

describe("cli input", () => {
  it("sends plain text on enter", () => {
    const onSubmit = vi.fn();
    const ui = createInput({ onSubmit, onSuggest: vi.fn() });
    ui.prompt();

    type(tty.stdin, "open youtube");
    press(tty.stdin, "return");

    expect(onSubmit).toHaveBeenCalledWith("open youtube");
    restore();
  });

  it("asks for suggestions as soon as you type a slash — no enter", () => {
    const onSuggest = vi.fn();
    const ui = createInput({ onSubmit: vi.fn(), onSuggest });
    ui.prompt();

    type(tty.stdin, "/");

    expect(onSuggest).toHaveBeenCalledWith("/");
    restore();
  });

  it("keeps asking as you refine the command", () => {
    const onSuggest = vi.fn();
    const ui = createInput({ onSubmit: vi.fn(), onSuggest });
    ui.prompt();

    type(tty.stdin, "/per");

    expect(onSuggest).toHaveBeenLastCalledWith("/per");
    restore();
  });

  it("does not ask for suggestions on normal chat", () => {
    const onSuggest = vi.fn();
    const ui = createInput({ onSubmit: vi.fn(), onSuggest });
    ui.prompt();

    type(tty.stdin, "hey there");

    expect(onSuggest).not.toHaveBeenCalled();
    restore();
  });

  it("renders the menu items when suggestions arrive", () => {
    const ui = createInput({ onSubmit: vi.fn(), onSuggest: vi.fn() });
    ui.prompt();
    type(tty.stdin, "/");
    ui.showSuggestions({
      kind: "command",
      items: [
        { value: "/personality", label: "/personality [name]", help: "switch how Kairos talks" },
        { value: "/mood", label: "/mood", help: "mood read" }
      ]
    });

    const text = tty.text();
    expect(text).toContain("/personality");
    expect(text).toContain("switch how Kairos talks");
    expect(text).toContain("tab complete");
    restore();
  });

  it("tab completes the highlighted command", () => {
    const onSuggest = vi.fn();
    const ui = createInput({ onSubmit: vi.fn(), onSuggest });
    ui.prompt();
    type(tty.stdin, "/per");
    ui.showSuggestions({ kind: "command", items: [{ value: "/personality", label: "/personality", help: "" }] });

    press(tty.stdin, "tab");

    expect(onSuggest).toHaveBeenLastCalledWith("/personality ");
    restore();
  });

  it("arrow keys move the selection", () => {
    const ui = createInput({ onSubmit: vi.fn(), onSuggest: vi.fn() });
    ui.prompt();
    type(tty.stdin, "/");
    ui.showSuggestions({
      kind: "command",
      items: [
        { value: "/personality", label: "/personality", help: "" },
        { value: "/mood", label: "/mood", help: "" }
      ]
    });

    const before = tty.written.length;
    press(tty.stdin, "down");
    expect(tty.written.length).toBeGreaterThan(before);
    restore();
  });

  it("tab picks a persona value after the command", () => {
    const onSubmit = vi.fn();
    const ui = createInput({ onSubmit, onSuggest: vi.fn() });
    ui.prompt();
    type(tty.stdin, "/personality ");
    ui.showSuggestions({
      kind: "value",
      command: "/personality",
      items: [
        { value: "aria", label: "Aria", help: "warm" },
        { value: "sassy", label: "Sassy", help: "dry" }
      ]
    });

    press(tty.stdin, "down");
    press(tty.stdin, "tab");
    press(tty.stdin, "return");

    expect(onSubmit).toHaveBeenCalledWith("/personality sassy");
    restore();
  });

  it("escape closes the menu and keeps typing", () => {
    const onSubmit = vi.fn();
    const ui = createInput({ onSubmit, onSuggest: vi.fn() });
    ui.prompt();
    type(tty.stdin, "/mood");
    ui.showSuggestions({ kind: "command", items: [{ value: "/mood", label: "/mood", help: "" }] });

    press(tty.stdin, "escape");
    press(tty.stdin, "return");

    expect(onSubmit).toHaveBeenCalledWith("/mood");
    restore();
  });

  it("backspace edits and re-queries", () => {
    const onSuggest = vi.fn();
    const ui = createInput({ onSubmit: vi.fn(), onSuggest });
    ui.prompt();
    type(tty.stdin, "/moodx");
    press(tty.stdin, "backspace");

    expect(onSuggest).toHaveBeenLastCalledWith("/mood");
    restore();
  });

  it("ignores input while a goal is running, then unlocks", () => {
    const onSubmit = vi.fn();
    const ui = createInput({ onSubmit, onSuggest: vi.fn() });
    ui.prompt();

    type(tty.stdin, "hey");
    press(tty.stdin, "return");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    type(tty.stdin, "again");
    press(tty.stdin, "return");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    ui.prompt();
    type(tty.stdin, "now");
    press(tty.stdin, "return");
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith("now");
    restore();
  });
});
