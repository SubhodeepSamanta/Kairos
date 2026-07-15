import { describe, it, expect, vi, beforeEach } from "vitest";

// visionReader uses tesseract.js — mock it to avoid loading the real worker
vi.mock("tesseract.js", () => {
  const mockRecognize = vi.fn();
  const mockTerminate = vi.fn();
  return {
    createWorker: vi.fn(() => Promise.resolve({
      recognize: mockRecognize,
      terminate: mockTerminate
    }))
  };
});

// Must import after mocks are set up
import * as visionReader from "../../../../../src/automation/browser/actions/observation/visionReader.js";

describe("visionReadPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for empty OCR result", async () => {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker();
    worker.recognize.mockResolvedValue({ data: { words: [] } });

    const page = { viewportSize: () => ({ width: 1280, height: 720 }), screenshot: vi.fn() };
    const result = await visionReader.visionReadPage(page);
    expect(result).toEqual([]);
  });

  it("returns elements for OCR words with sufficient length", async () => {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker();
    worker.recognize.mockResolvedValue({
      data: {
        words: [
          { text: "Hello", confidence: 85, bbox: { x0: 10, y0: 20, x1: 60, y1: 40 } },
          { text: "World", confidence: 90, bbox: { x0: 70, y0: 20, x1: 130, y1: 40 } }
        ]
      }
    });

    const page = { viewportSize: () => ({ width: 1280, height: 720 }), screenshot: vi.fn() };
    const result = await visionReader.visionReadPage(page);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Hello");
    expect(result[0].ariaRole).toBe("vision_text");
  });

  it("skips words with fewer than 2 characters", async () => {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker();
    worker.recognize.mockResolvedValue({
      data: {
        words: [
          { text: "a", confidence: 80, bbox: { x0: 0, y0: 0, x1: 5, y1: 10 } },
          { text: "OK", confidence: 95, bbox: { x0: 10, y0: 0, x1: 30, y1: 10 } }
        ]
      }
    });

    const page = { viewportSize: () => ({ width: 1280, height: 720 }), screenshot: vi.fn() };
    const result = await visionReader.visionReadPage(page);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("OK");
  });

  it("deduplicates words case-insensitively", async () => {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker();
    worker.recognize.mockResolvedValue({
      data: {
        words: [
          { text: "Hello", confidence: 80, bbox: { x0: 0, y0: 0, x1: 30, y1: 10 } },
          { text: "hello", confidence: 85, bbox: { x0: 0, y0: 0, x1: 30, y1: 10 } }
        ]
      }
    });

    const page = { viewportSize: () => ({ width: 1280, height: 720 }), screenshot: vi.fn() };
    const result = await visionReader.visionReadPage(page);
    expect(result).toHaveLength(1);
  });
});

describe("visionLocateText", () => {
  it("finds best matching element by text", async () => {
    const elements = [
      { ariaRole: "vision_text", text: "hello", confidence: 0.7 },
      { ariaRole: "vision_text", text: "hello", confidence: 0.9 },
      { ariaRole: "button", text: "hello", confidence: 1.0 }
    ];
    const result = await visionReader.visionLocateText(null, "hello", elements);
    expect(result.confidence).toBe(0.9);
  });

  it("returns null when no match", async () => {
    const result = await visionReader.visionLocateText(null, "nonexistent", []);
    expect(result).toBeNull();
  });
});

describe("destroyVisionWorker", () => {
  it("terminates worker", async () => {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker();
    worker.terminate.mockResolvedValue();
    await visionReader.destroyVisionWorker();
    expect(worker.terminate).toHaveBeenCalled();
  });
});
