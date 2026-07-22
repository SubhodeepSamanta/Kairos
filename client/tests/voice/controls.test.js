import { describe, it, expect } from "vitest";
import { deliveryCommand, applyDelivery, DELIVERY_DEFAULT } from "../../src/voice/controls.js";

describe("deliveryCommand", () => {
  it("recognises the natural ways to ask", () => {
    expect(deliveryCommand("slow down")).toBe("slower");
    expect(deliveryCommand("speak slower")).toBe("slower");
    expect(deliveryCommand("faster")).toBe("faster");
    expect(deliveryCommand("speed up")).toBe("faster");
    expect(deliveryCommand("louder")).toBe("louder");
    expect(deliveryCommand("speak up")).toBe("louder");
    expect(deliveryCommand("quieter")).toBe("quieter");
    expect(deliveryCommand("softer")).toBe("quieter");
    expect(deliveryCommand("back to normal")).toBe("reset");
  });

  it("ignores real requests that merely contain the words", () => {
    expect(deliveryCommand("slow down the video on youtube")).toBeNull();
    expect(deliveryCommand("turn the music up on spotify")).toBeNull();
    expect(deliveryCommand("what is a faster route home")).toBeNull();
    expect(deliveryCommand("")).toBeNull();
  });
});

describe("applyDelivery", () => {
  it("moves rate down and back up symmetrically", () => {
    const slow = applyDelivery(DELIVERY_DEFAULT, "slower").delivery;
    expect(slow.rate).toBeLessThan(1);
    const back = applyDelivery(slow, "faster").delivery;
    expect(back.rate).toBeCloseTo(1, 5);
  });

  it("clamps rate at the floor and reports the limit", () => {
    let d = DELIVERY_DEFAULT;
    for (let i = 0; i < 10; i++) d = applyDelivery(d, "slower").delivery;
    expect(d.rate).toBeGreaterThanOrEqual(0.6);
    const atLimit = applyDelivery(d, "slower");
    expect(atLimit.delivery.rate).toBe(d.rate);
    expect(atLimit.confirm).toMatch(/as far as I go/);
  });

  it("clamps volume between 0.3 and 1", () => {
    let d = DELIVERY_DEFAULT;
    for (let i = 0; i < 10; i++) d = applyDelivery(d, "quieter").delivery;
    expect(d.volume).toBeGreaterThanOrEqual(0.3);
    let up = d;
    for (let i = 0; i < 10; i++) up = applyDelivery(up, "louder").delivery;
    expect(up.volume).toBeLessThanOrEqual(1);
  });

  it("reset returns to the defaults", () => {
    const d = applyDelivery({ rate: 1.4, volume: 0.4 }, "reset").delivery;
    expect(d).toEqual({ rate: 1, volume: 1 });
  });

  it("returns null for a non-command", () => {
    expect(applyDelivery(DELIVERY_DEFAULT, "nope")).toBeNull();
  });
});
