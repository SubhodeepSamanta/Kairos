import { describe, it, expect } from "vitest";
import { parseJsonResponse, createBudget } from "../../src/llm/provider.js";

describe("parseJsonResponse", () => {
  it("parses plain JSON", () => {
    expect(parseJsonResponse('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses fenced JSON", () => {
    expect(parseJsonResponse('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON surrounded by prose", () => {
    expect(parseJsonResponse('Here is my answer:\n{"thought":"hi","action":{"type":"read"}}\nDone.')).toEqual({
      thought: "hi",
      action: { type: "read" }
    });
  });

  it("tolerates trailing commas", () => {
    expect(parseJsonResponse('{"a":1,}')).toEqual({ a: 1 });
  });

  it("returns null for garbage", () => {
    expect(parseJsonResponse("no json here")).toBeNull();
    expect(parseJsonResponse("")).toBeNull();
    expect(parseJsonResponse(null)).toBeNull();
  });
});

describe("createBudget", () => {
  it("starts empty with the given cap", () => {
    const b = createBudget(10);
    expect(b.used).toBe(0);
    expect(b.maxCalls).toBe(10);
    expect(b.estimatedTokens).toBe(0);
  });
});
