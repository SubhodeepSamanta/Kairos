import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateAction, knownActionTypes } from "../../src/agent/actionSchema.js";

describe("actions that must be allowed through", () => {
  it("accepts every well formed action", () => {
    const good = [
      { type: "navigate", url: "https://youtube.com" },
      { type: "navigate", url: "youtube.com" },
      { type: "click", id: 3 },
      { type: "click", id: "3" },
      { type: "type", id: 1, text: "lofi", submit: true },
      { type: "select_option", id: 2, value: "Large" },
      { type: "press_key", key: "Enter" },
      { type: "scroll", direction: "down" },
      { type: "scroll" },
      { type: "back" }, { type: "refresh" }, { type: "read" }, { type: "screenshot" },
      { type: "new_tab" }, { type: "new_window" }, { type: "close_tab" },
      { type: "switch_tab", index: 0 },
      { type: "wait", seconds: 2 },
      { type: "list_browsers" },
      { type: "use_browser", browser: "chrome", profile: null },
      { type: "open_for_user", url: "https://twitch.tv" },
      { type: "close_user_browser", browser: "chrome" },
      { type: "web_search", query: "cheap flights" },
      { type: "fetch_page", url: "https://weather.com" },
      { type: "weather", place: "Kolkata" },
      { type: "weather" },
      { type: "list_apps" },
      { type: "open_app", app: "Notepad" },
      { type: "focus_app", app: "Calculator" },
      { type: "close_app", app: "Notepad" },
      { type: "read_desktop" },
      { type: "click_element", id: 4 },
      { type: "type_into", id: 2, text: "hello", submit: true },
      { type: "set_toggle", id: 3 },
      { type: "select_menu", id: 5, value: "Large" },
      { type: "press_keys", keys: "Ctrl+S" },
      { type: "remember", key: "site:twitch", value: "https://twitch.tv" },
      { type: "ask_human", question: "which account?" },
      { type: "done", success: true, answer: "done" },
      { type: "done" }
    ];
    for (const action of good) {
      expect(validateAction(action), `${action.type}: ${JSON.stringify(action)}`).toBeNull();
    }
  });

  it("allows a switch_tab back to index zero", () => {
    expect(validateAction({ type: "switch_tab", index: 0 })).toBeNull();
  });
});

describe("actions that would have wasted a round trip", () => {
  it("catches a missing required field and names it", () => {
    expect(validateAction({ type: "click" })).toMatch(/"id" missing/);
    expect(validateAction({ type: "navigate" })).toMatch(/"url" missing/);
    expect(validateAction({ type: "type", id: 1 })).toMatch(/"text" missing/);
    expect(validateAction({ type: "web_search" })).toMatch(/"query" missing/);
  });

  it("catches an id that is not a number", () => {
    expect(validateAction({ type: "click", id: "the blue button" })).toMatch(/must be a number/);
  });

  it("catches a url that is not a url", () => {
    expect(validateAction({ type: "navigate", url: "the youtube homepage" })).toMatch(/does not look like a url/);
  });

  it("catches an empty string where text was needed", () => {
    expect(validateAction({ type: "web_search", query: "   " })).toMatch(/is empty/);
  });

  it("rejects an unknown action type by name", () => {
    expect(validateAction({ type: "teleport", to: "mars" })).toMatch(/Unknown action type "teleport"/);
  });

  it("rejects a reply with no action at all", () => {
    expect(validateAction(null)).toMatch(/no action object/);
    expect(validateAction({})).toMatch(/no "type"/);
  });

  it("lists more than one problem at once", () => {
    const why = validateAction({ type: "type" });
    expect(why).toMatch(/"id" missing/);
    expect(why).toMatch(/"text" missing/);
  });
});

const askLLMJson = vi.fn();
vi.mock("../../src/llm/provider.js", () => ({
  askLLMJson: (...args) => askLLMJson(...args),
  createBudget: (maxCalls) => ({ used: 0, maxCalls, estimatedTokens: 0, tokensIn: 0, tokensOut: 0, measured: 0, llmMs: 0 })
}));
const { runAgent } = await import("../../src/agent/loop/agentLoop.js");

beforeEach(() => askLLMJson.mockReset());

describe("in the loop", () => {
  it("corrects a malformed action without spending a client round trip", async () => {
    const replies = [
      { thought: "click it", action: { type: "click" } },
      { thought: "click it properly", action: { type: "click", id: 1 } },
      { thought: "done", action: { type: "done", success: true, answer: "clicked" } }
    ];
    let i = 0;
    askLLMJson.mockImplementation(async (_s, userPrompt) => {
      if (i === 1) expect(userPrompt).toMatch(/"id" missing/);
      return replies[Math.min(i++, replies.length - 1)];
    });

    const executed = [];
    const result = await runAgent({
      goal: "click the button",
      chatId: "schema-loop",
      executeAction: async (a) => { executed.push(a); return { success: true, page: { url: "https://x.com", buttons: [{ id: 1, text: "Go" }] } }; },
      askHuman: async () => "",
      isCancelled: () => false
    });

    expect(executed).toHaveLength(1);
    expect(result.success).toBe(true);
  });

  it("gives up honestly when the AI will not produce a runnable action", async () => {
    askLLMJson.mockResolvedValue({ thought: "hmm", action: { type: "click" } });

    const executed = [];
    const result = await runAgent({
      goal: "click the button",
      chatId: "schema-giveup",
      executeAction: async (a) => { executed.push(a); return { success: true }; },
      askHuman: async () => "",
      isCancelled: () => false
    });

    expect(executed).toHaveLength(0);
    expect(result.success).toBe(false);
    expect(result.answer).toMatch(/could not run/i);
  });
});

describe("the schema and the loop agree", () => {
  it("knows every type the system prompt documents", async () => {
    const { SYSTEM_PROMPT, DESKTOP_RULES } = await import("../../src/agent/prompt.js");
    const documented = `${SYSTEM_PROMPT}\n${DESKTOP_RULES}`;
    for (const type of knownActionTypes()) {
      expect(documented, `${type} is validated but never documented`).toContain(type);
    }
  });
});
