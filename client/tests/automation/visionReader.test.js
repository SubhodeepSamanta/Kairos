import { describe, it, expect } from "vitest";
import { wordsFrom } from "../../src/automation/browser/actions/observation/visionReader.js";

describe("ocr word extraction", () => {
  it("reads words out of the nested block structure tesseract returns", () => {
    const data = {
      blocks: [{
        paragraphs: [{
          lines: [
            { words: [{ text: "Sign", confidence: 92 }, { text: "in", confidence: 90 }] },
            { words: [{ text: "Inbox", confidence: 88 }] }
          ]
        }]
      }]
    };
    expect(wordsFrom(data).map(w => w.text)).toEqual(["Sign", "in", "Inbox"]);
  });

  it("still accepts the flat shape if a future version returns one", () => {
    expect(wordsFrom({ words: [{ text: "Hello" }] }).map(w => w.text)).toEqual(["Hello"]);
  });

  it("returns nothing rather than throwing on an empty or odd result", () => {
    expect(wordsFrom({})).toEqual([]);
    expect(wordsFrom(null)).toEqual([]);
    expect(wordsFrom({ blocks: [{}] })).toEqual([]);
  });
});
