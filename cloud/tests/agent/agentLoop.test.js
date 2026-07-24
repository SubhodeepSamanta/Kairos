import { describe, it, expect, vi, beforeEach } from "vitest";

const llmQueue = [];
const remembered = {};

vi.mock("../../src/llm/provider.js", () => ({
  createBudget: (maxCalls = 45) => ({ used: 0, maxCalls, estimatedTokens: 0 }),
  askLLM: vi.fn(async () => "NOTHING"),
  askLLMJson: vi.fn(async (system, user, budget) => {
    if (budget.used >= budget.maxCalls) throw new Error("llm_budget_exceeded: test");
    budget.used++;
    if (!llmQueue.length) throw new Error("test llm queue empty");
    const next = llmQueue.shift();
    if (typeof next === "function") return next(system, user);
    return next;
  })
}));

vi.mock("../../src/companion/store.js", () => ({
  addTurn: vi.fn(async () => {}),
  addEvent: vi.fn(async () => {}),
  addMood: vi.fn(async () => {}),
  loadTurns: vi.fn(async () => []),
  loadEvents: vi.fn(async () => []),
  loadMoods: vi.fn(async () => []),
  getPrefs: vi.fn(async () => ({ persona: "aria", moodTracking: true })),
  setPrefs: vi.fn(async () => ({})),
  getSummary: vi.fn(async () => ({ text: "", coveredTurns: 0 })),
  setSummary: vi.fn(async () => {}),
  countTurns: vi.fn(async () => 0),
  loadTurnsBefore: vi.fn(async () => []),
  getDigest: vi.fn(async () => null),
  setDigest: vi.fn(async () => {}),
  forgetChat: vi.fn(async () => [])
}));

vi.mock("../../src/memory/store.js", () => ({
  rememberFact: vi.fn((k, v) => { remembered[k] = v; return true; }),
  relevantFacts: vi.fn(() => ({ github_username: "tester" })),
  formatFactsForPrompt: vi.fn(facts => Object.entries(facts).map(([k, v]) => `${k}: ${v}`).join("\n") || "none yet")
}));

vi.mock("../../src/agent/webTools.js", () => ({
  webSearch: vi.fn(async () => [{ title: "Twitch", url: "https://twitch.tv", snippet: "live" }]),
  formatSearchResults: vi.fn(r => r.map(x => `${x.title} ${x.url}`).join("\n")),
  fetchPageText: vi.fn(async () => "TITLE: News\nheadline one headline two")
}));

import { runAgent } from "../../src/agent/loop/agentLoop.js";
import { addEvent } from "../../src/companion/store.js";
import { fetchPageText } from "../../src/agent/webTools.js";

beforeEach(() => {
  llmQueue.length = 0;
  for (const k of Object.keys(remembered)) delete remembered[k];
  vi.mocked(addEvent).mockClear();
});

function makeExecutor(pages = {}) {
  const calls = [];
  return {
    calls,
    executeAction: vi.fn(async (action) => {
      calls.push(action);
      if (action.type === "store_secret") return { success: true };
      const url = action.type === "navigate" ? action.params.url : "https://current.example";
      return { success: true, page: { url, title: "Page", inputs: [], buttons: [], links: [], text: "", ...pages } };
    })
  };
}

describe("runAgent", () => {
  it("answers chat goals directly without touching the browser", async () => {
    llmQueue.push({ thought: "just a greeting", action: { type: "done", success: true, answer: "Hello! How can I help?" } });
    const { executeAction, calls } = makeExecutor();
    const result = await runAgent({ goal: "hi", goalId: "g1", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(true);
    expect(result.answer).toContain("Hello");
    expect(calls.length).toBe(0);
  });

  it("executes browser actions then finishes", async () => {
    llmQueue.push({ thought: "open yt", action: { type: "navigate", url: "https://youtube.com" } });
    llmQueue.push({ thought: "done", action: { type: "done", success: true, answer: "Opened YouTube" } });
    const { executeAction, calls } = makeExecutor();
    const result = await runAgent({ goal: "open youtube", goalId: "g2", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(true);
    expect(calls[0]).toEqual({ type: "navigate", params: { url: "https://youtube.com" } });
  });

  it("saves remember entries from done", async () => {
    llmQueue.push({ thought: "", action: { type: "done", success: true, answer: "ok", remember: { "site:twitch": "https://twitch.tv" } } });
    const { executeAction } = makeExecutor();
    await runAgent({ goal: "open twitch", goalId: "g3", executeAction, askHuman: vi.fn() });
    expect(remembered["site:twitch"]).toBe("https://twitch.tv");
  });

  it("routes ask_human answers back into history", async () => {
    llmQueue.push({ thought: "ambiguous", action: { type: "ask_human", question: "Lofi where — YouTube or Spotify?" } });
    llmQueue.push((system, user) => {
      expect(user).toContain("user replied: \"youtube\"");
      return { thought: "", action: { type: "done", success: true, answer: "ok" } };
    });
    const askHuman = vi.fn(async () => "youtube");
    const { executeAction } = makeExecutor();
    const result = await runAgent({ goal: "open lofi", goalId: "g4", executeAction, askHuman });
    expect(askHuman).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  it("stores secrets on the client and only exposes the placeholder", async () => {
    llmQueue.push({ thought: "", action: { type: "ask_human", question: "GitHub password?", secret_name: "github_password" } });
    llmQueue.push((system, user) => {
      expect(user).toContain("{{secret:github_password}}");
      expect(user).not.toContain("hunter2");
      return { thought: "", action: { type: "done", success: true, answer: "logged in" } };
    });
    const askHuman = vi.fn(async () => "hunter2");
    const { executeAction, calls } = makeExecutor();
    await runAgent({ goal: "login to github", goalId: "g5", executeAction, askHuman });
    expect(calls[0]).toEqual({ type: "store_secret", params: { name: "github_password", value: "hunter2" } });
  });

  it("aborts after repeating the same action too many times", async () => {
    for (let i = 0; i < 8; i++) {
      llmQueue.push({ thought: "click it", action: { type: "click", id: 5 } });
    }
    const { executeAction } = makeExecutor();
    const result = await runAgent({ goal: "stuck goal", goalId: "g6", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(false);
    expect(result.answer).toContain("repeating");
  });

  it("runs web_search without the browser", async () => {
    llmQueue.push({ thought: "find twitch", action: { type: "web_search", query: "twitch" } });
    llmQueue.push((system, user) => {
      expect(user).toContain("https://twitch.tv");
      return { thought: "", action: { type: "done", success: true, answer: "found it" } };
    });
    const { executeAction, calls } = makeExecutor();
    const result = await runAgent({ goal: "find twitch url", goalId: "g7", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(true);
    expect(calls.length).toBe(0);
  });

  it("fails gracefully when the client is disconnected", async () => {
    llmQueue.push({ thought: "", action: { type: "navigate", url: "https://x.com" } });
    const executeAction = vi.fn(async () => { throw new Error("no_client_connected"); });
    const result = await runAgent({ goal: "open x", goalId: "g8", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(false);
    expect(result.answer).toContain("not connected");
  });

  it("feeds action failures back to the model", async () => {
    llmQueue.push({ thought: "", action: { type: "click", id: 99 } });
    llmQueue.push((system, user) => {
      expect(user).toContain("FAILED: Unknown element 99");
      return { thought: "", action: { type: "done", success: false, answer: "could not" } };
    });
    const executeAction = vi.fn(async () => ({ success: false, reason: "Unknown element 99" }));
    const result = await runAgent({ goal: "click thing", goalId: "g9", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(false);
  });

  it("injects memories into the prompt", async () => {
    llmQueue.push((system, user) => {
      expect(user).toContain("github_username: tester");
      return { thought: "", action: { type: "done", success: true, answer: "ok" } };
    });
    const { executeAction } = makeExecutor();
    await runAgent({ goal: "show my github", goalId: "g10", executeAction, askHuman: vi.fn() });
  });

  it("does not record an episodic event for a pure chat turn", async () => {
    llmQueue.push({ thought: "", action: { type: "done", success: true, answer: "that sounds rough. want to talk about it?" } });
    const { executeAction } = makeExecutor();
    await runAgent({ goal: "been really tired lately", goalId: "g11", executeAction, askHuman: vi.fn() });
    expect(addEvent).not.toHaveBeenCalled();
  });

  it("records an episodic event when the goal actually did something", async () => {
    llmQueue.push({ thought: "", action: { type: "navigate", url: "https://youtube.com" } });
    llmQueue.push({ thought: "", action: { type: "done", success: true, answer: "opened" } });
    const { executeAction } = makeExecutor();
    await runAgent({ goal: "open youtube", goalId: "g12", executeAction, askHuman: vi.fn() });
    expect(addEvent).toHaveBeenCalledOnce();
  });

  it("tells the model on step 1 that nothing has run yet, whatever the conversation says", async () => {
    llmQueue.push((system, user) => {
      expect(user).toContain("NO browser action has run this goal");
      expect(user).toContain("no matter what CONVERSATION or MEMORIES say");
      return { thought: "", action: { type: "navigate", url: "https://twitch.tv" } };
    });
    llmQueue.push((system, user) => {
      expect(user).not.toContain("NO browser action has run this goal");
      return { thought: "", action: { type: "done", success: true, answer: "opened" } };
    });
    const { executeAction } = makeExecutor();
    const result = await runAgent({ goal: "open twitch", goalId: "g14", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(true);
  });

  it("opens a site in the user's browser once and never a second time", async () => {
    llmQueue.push({ thought: "", action: { type: "open_for_user", url: "https://www.youtube.com/results?search_query=lofi" } });
    llmQueue.push({ thought: "", action: { type: "open_for_user", url: "https://www.youtube.com/results?search_query=lofi+music" } });
    llmQueue.push({ thought: "", action: { type: "open_for_user", url: "https://youtube.com/results?search_query=lofi+beats" } });
    llmQueue.push((system, user) => {
      expect(user).toContain("piles up tabs");
      return { thought: "", action: { type: "done", success: true, answer: "opened" } };
    });
    const { executeAction, calls } = makeExecutor();
    const result = await runAgent({ goal: "search youtube for lofi music", goalId: "g15", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(true);
    expect(calls.filter(c => c.type === "open_for_user")).toHaveLength(1);
  });

  it("aborts instead of opening tabs forever", async () => {
    for (let i = 0; i < 12; i++) {
      llmQueue.push({ thought: "", action: { type: "open_for_user", url: `https://youtube.com/watch?v=${i}` } });
    }
    const { executeAction, calls } = makeExecutor();
    const result = await runAgent({ goal: "play lofi music", goalId: "g16", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(false);
    expect(result.answer).toContain("stopped myself");
    expect(calls.filter(c => c.type === "open_for_user")).toHaveLength(1);
  });

  it("caps blank tab spam", async () => {
    for (let i = 0; i < 3; i++) llmQueue.push({ thought: "", action: { type: "new_tab" } });
    llmQueue.push((system, user) => {
      expect(user).toContain("No more tabs");
      return { thought: "", action: { type: "done", success: true, answer: "ok" } };
    });
    const { executeAction, calls } = makeExecutor();
    const result = await runAgent({ goal: "open a few tabs", goalId: "g17", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(true);
    expect(calls.filter(c => c.type === "new_tab")).toHaveLength(2);
  });

  it("keeps earlier sources readable for synthesis instead of trimming them away", async () => {
    vi.mocked(fetchPageText).mockImplementation(async (url) =>
      "x".repeat(350) + (url.includes("a.com") ? " MARKER_A " : " filler ") + "y".repeat(400)
    );
    llmQueue.push({ thought: "", action: { type: "fetch_page", url: "https://a.com" } });
    for (const host of ["b", "c", "d", "e"]) {
      llmQueue.push({ thought: "", action: { type: "fetch_page", url: `https://${host}.com` } });
    }
    llmQueue.push({ thought: "", action: { type: "scroll", direction: "down" } });
    llmQueue.push({ thought: "", action: { type: "scroll", direction: "up" } });
    llmQueue.push((system, user) => {
      expect(user).toContain("(older detail trimmed)");
      expect(user).toContain("WHAT YOU'VE READ");
      expect(user).toContain("MARKER_A");
      return { thought: "", action: { type: "done", success: true, answer: "ok" } };
    });
    const { executeAction } = makeExecutor();
    const result = await runAgent({ goal: "best sunscreen", goalId: "g18", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(true);
  });

  it("stops itself when it keeps looping back to the same page", async () => {
    for (let id = 1; id <= 12; id++) {
      llmQueue.push({ thought: "", action: { type: "click", id } });
    }
    const executeAction = vi.fn(async (action) => {
      const id = action.params.element;
      const url = id % 2 === 0 ? "https://yt.com/results" : `https://yt.com/watch${id}`;
      return { success: true, page: { url, title: "t", inputs: [], buttons: [], links: [], text: "" } };
    });
    const result = await runAgent({ goal: "play a song", goalId: "g19", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(false);
    expect(result.answer).toContain("looping back to the same page");
  });

  it("trims detail from old history entries but keeps recent ones verbatim", async () => {
    vi.mocked(fetchPageText).mockResolvedValue("A".repeat(1000));
    for (let i = 0; i < 8; i++) {
      llmQueue.push({ thought: "", action: { type: "fetch_page", url: `https://site${i}.com` } });
    }
    llmQueue.push((system, user) => {
      expect(user).toContain("(older detail trimmed)");
      expect(user).toContain(`site7.com →\n${"A".repeat(1000)}`);
      return { thought: "", action: { type: "done", success: true, answer: "ok" } };
    });
    const { executeAction } = makeExecutor();
    const result = await runAgent({ goal: "research", goalId: "g13", executeAction, askHuman: vi.fn() });
    expect(result.success).toBe(true);
  });
});
