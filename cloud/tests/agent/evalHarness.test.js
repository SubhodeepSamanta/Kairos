import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { judge, normalizeAction } from "../../eval/judge.js";
import { SYSTEM_PROMPT, buildStepPrompt } from "../../src/agent/prompt.js";

const evalDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "eval");
const cases = JSON.parse(fs.readFileSync(path.join(evalDir, "cases.json"), "utf8"));

describe("the judge", () => {
  it("accepts an action from the allowed set", () => {
    expect(judge({ action: { type: "done", answer: "hi" } }, { only: ["done"] }).pass).toBe(true);
  });

  it("rejects an action outside the allowed set and says what it wanted", () => {
    const v = judge({ action: { type: "navigate", url: "x" } }, { only: ["done"] });
    expect(v.pass).toBe(false);
    expect(v.why).toMatch(/chose navigate/);
  });

  it("rejects an action that was explicitly forbidden", () => {
    const v = judge({ action: { type: "open_for_user", url: "x" } }, { not: ["open_for_user"] });
    expect(v.pass).toBe(false);
    expect(v.why).toMatch(/must not do/);
  });

  it("fails a reply with no usable action rather than crediting it", () => {
    expect(judge({ thought: "hmm" }, { only: ["done"] }).pass).toBe(false);
    expect(judge(null, { only: ["done"] }).pass).toBe(false);
  });

  it("reads params whether they are nested or flattened", () => {
    expect(normalizeAction({ type: "click", params: { id: 2 } })).toEqual({ type: "click", id: 2 });
    expect(judge({ action: { type: "click", params: { id: 2 } } }, { only: ["click"], paramIn: { id: [1, 2] } }).pass).toBe(true);
  });

  it("catches a click on an element that was not offered", () => {
    const v = judge({ action: { type: "click", id: 9 } }, { only: ["click"], paramIn: { id: [1, 2] } });
    expect(v.pass).toBe(false);
    expect(v.why).toMatch(/id=9/);
  });

  it("catches an answer that dropped the fact it was supposed to carry", () => {
    const v = judge({ action: { type: "done", answer: "it's warm out" } }, { only: ["done"], answerContains: ["31"] });
    expect(v.pass).toBe(false);
    expect(v.why).toMatch(/left out 31/);
  });
});

describe("the recorded cases", () => {
  it("all have an id, a reason and something to assert", () => {
    for (const c of cases) {
      expect(c.id, JSON.stringify(c).slice(0, 80)).toBeTruthy();
      expect(c.why, c.id).toBeTruthy();
      expect(c.goal, c.id).toBeTruthy();
      expect(c.snapshot, c.id).toBeTruthy();
      const e = c.expect || {};
      expect(Boolean(e.only || e.not), c.id).toBe(true);
    }
  });

  it("have unique ids so a failure points at one case", () => {
    const ids = cases.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("build a prompt carrying the goal, the page and the steps so far", () => {
    for (const c of cases) {
      const prompt = buildStepPrompt({
        goal: c.goal, memories: "(nothing saved yet)", history: c.history || [],
        snapshot: c.snapshot, notice: "", summary: "", conversation: "", recentDays: "", mood: ""
      });
      expect(prompt, c.id).toContain(c.goal);
      expect(prompt, c.id).toContain("CURRENT PAGE:");
      for (const step of c.history || []) {
        expect(prompt, `${c.id} lost a history line`).toContain(step.slice(0, 40));
      }
    }
  });
});

describe("the system prompt", () => {
  it("still documents every action the judge expects cases to choose", () => {
    const wanted = new Set();
    for (const c of cases) for (const t of [...(c.expect.only || []), ...(c.expect.not || [])]) wanted.add(t);
    for (const type of wanted) {
      expect(SYSTEM_PROMPT, `${type} is expected by a case but absent from the prompt`).toContain(type);
    }
  });
});
