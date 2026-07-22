import { describe, it, expect } from "vitest";
import { detectChanges } from "../../../../src/automation/browser/actions/input/click.js";

function snapshot(overrides = {}) {
  return {
    url: "https://example.com",
    title: "Example",
    body: "hello",
    active: { tag: "BODY", id: "", class: "", value: "" },
    media: [],
    elementStates: [],
    overlayVisible: false,
    ...overrides
  };
}

describe("detectChanges", () => {
  it("does not call a no-op click a success just because a video keeps playing", () => {
    const playing = { paused: false, volume: 1, muted: false };
    const before = snapshot({ media: [playing] });
    const after = snapshot({ media: [{ ...playing }] });
    expect(detectChanges(before, after, false)).toBe(false);
  });

  it("still detects a click that paused the media", () => {
    const before = snapshot({ media: [{ paused: false, volume: 1, muted: false }] });
    const after = snapshot({ media: [{ paused: true, volume: 1, muted: false }] });
    expect(detectChanges(before, after, false)).toBe(true);
  });

  it("still detects a click that muted the media", () => {
    const before = snapshot({ media: [{ paused: false, volume: 1, muted: false }] });
    const after = snapshot({ media: [{ paused: false, volume: 1, muted: true }] });
    expect(detectChanges(before, after, false)).toBe(true);
  });

  it("detects a navigation", () => {
    expect(detectChanges(snapshot(), snapshot({ url: "https://example.com/next" }), false)).toBe(true);
  });

  it("detects a newly opened tab even when the page looks identical", () => {
    expect(detectChanges(snapshot(), snapshot(), true)).toBe(true);
  });

  it("reports no change when nothing moved", () => {
    expect(detectChanges(snapshot(), snapshot(), false)).toBe(false);
  });
});
