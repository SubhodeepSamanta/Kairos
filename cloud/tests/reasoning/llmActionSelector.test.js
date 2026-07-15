import { describe, it, expect } from "vitest";
import { sanitizeLlmAction, matchLlmActionToCandidate, cleanAndParseJson } from "../../src/reasoning/llmActionSelector.js";

describe("cleanAndParseJson", () => {
  it("parses clean JSON", () => {
    const result = cleanAndParseJson('{"actions":[{"type":"click","params":{"element":3}}]}');
    expect(result).toEqual({ actions: [{ type: "click", params: { element: 3 } }] });
  });

  it("strips markdown code blocks", () => {
    const result = cleanAndParseJson('```json\n{"actions":[{"type":"click","params":{"element":3}}]}\n```');
    expect(result.actions[0].type).toBe("click");
  });

  it("extracts JSON from surrounding text", () => {
    const result = cleanAndParseJson('Here is the action: {"actions":[{"type":"click","params":{"element":3}}]} Thank you.');
    expect(result.actions[0].params.element).toBe(3);
  });

  it("returns null for invalid input", () => {
    expect(cleanAndParseJson("")).toBeNull();
    expect(cleanAndParseJson("no json here")).toBeNull();
    expect(cleanAndParseJson(null)).toBeNull();
  });
});

describe("sanitizeLlmAction", () => {
  const pageUnderstanding = { importantElements: [{ id: 3 }] };

  it("keeps valid positive integer element IDs", () => {
    const input = { type: "click", params: { element: 3 } };
    const result = sanitizeLlmAction(input, pageUnderstanding);
    expect(result.params.element).toBe(3);
  });

  it("strips non-numeric element IDs", () => {
    const input = { type: "click", params: { element: "Search Button" } };
    const result = sanitizeLlmAction(input, pageUnderstanding);
    expect(result.params.element).toBeUndefined();
  });

  it("keeps text params", () => {
    const input = { type: "type", params: { element: 1, text: "hello" } };
    const result = sanitizeLlmAction(input, pageUnderstanding);
    expect(result.params.text).toBe("hello");
  });

  it("keeps url params", () => {
    const input = { type: "navigate", params: { url: "https://example.com" } };
    const result = sanitizeLlmAction(input, pageUnderstanding);
    expect(result.params.url).toBe("https://example.com");
  });

  it("returns null for null input", () => {
    expect(sanitizeLlmAction(null, pageUnderstanding)).toBeNull();
  });
});

describe("matchLlmActionToCandidate", () => {
  const candidates = [
    { type: "click", elementId: 3, actions: [{ type: "click", params: { element: 3 } }] },
    { type: "click", elementId: 5, actions: [{ type: "click", params: { element: 5 } }] },
    { type: "type", elementId: 1, actions: [{ type: "type", params: { element: 1, text: "" } }] },
    { type: "navigate", actions: [{ type: "navigate", params: { url: "" } }] }
  ];

  it("matches click by element ID", () => {
    const llmAction = { type: "click", params: { element: 3 } };
    const result = matchLlmActionToCandidate(llmAction, candidates);
    expect(result).not.toBeNull();
    expect(result.elementId).toBe(3);
  });

  it("matches type and injects text", () => {
    const llmAction = { type: "type", params: { element: 1, text: "search query" } };
    const result = matchLlmActionToCandidate(llmAction, candidates);
    expect(result).not.toBeNull();
    expect(result.actions[0].params.text).toBe("search query");
  });

  it("returns null for non-matching element", () => {
    const llmAction = { type: "click", params: { element: 999 } };
    const result = matchLlmActionToCandidate(llmAction, candidates);
    expect(result).toBeNull();
  });

  it("matches navigate without element ID", () => {
    const llmAction = { type: "navigate", params: { url: "https://example.com" } };
    const result = matchLlmActionToCandidate(llmAction, candidates);
    expect(result).not.toBeNull();
    expect(result.actions[0].params.url).toBe("https://example.com");
  });
});
