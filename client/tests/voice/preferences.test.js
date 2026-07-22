import { describe, it, expect } from "vitest";
import { sanitizeDelivery, loadDelivery, saveDelivery } from "../../src/voice/preferences.js";
import { DELIVERY_DEFAULT } from "../../src/voice/controls.js";

describe("sanitizeDelivery", () => {
  it("keeps a valid setting", () => {
    expect(sanitizeDelivery({ rate: 0.85, volume: 0.7 })).toEqual({ rate: 0.85, volume: 0.7 });
  });

  it("clamps out-of-range values instead of trusting the file", () => {
    expect(sanitizeDelivery({ rate: 9, volume: 9 })).toEqual({ rate: 1.6, volume: 1 });
    expect(sanitizeDelivery({ rate: 0, volume: 0 })).toEqual({ rate: 0.6, volume: 0.3 });
  });

  it("rejects junk", () => {
    expect(sanitizeDelivery(null)).toBeNull();
    expect(sanitizeDelivery({ rate: "fast" })).toBeNull();
    expect(sanitizeDelivery("nope")).toBeNull();
  });
});

describe("delivery persistence under test", () => {
  it("loads the default and never touches disk", () => {
    expect(loadDelivery()).toEqual(DELIVERY_DEFAULT);
    expect(() => saveDelivery({ rate: 0.85, volume: 1 })).not.toThrow();
  });
});
