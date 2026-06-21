import { registerElement } from "../../elements/registry.js";
import { classifyElement } from "../classifier/index.js";

export async function readButtons(page) {
  const buttons = [];
  const buttonLocators = page.locator("button:not([disabled]), [role='button']");
  const buttonCount = await buttonLocators.count().catch(() => 0);

  const viewportHeight = await page.evaluate(() => window.innerHeight).catch(() => 800);

  for (let i = 0; i < buttonCount; i++) {
    const locator = buttonLocators.nth(i);
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    const id = await locator.getAttribute("data-kairos-id").catch(() => null);
    if (!id) continue;

    const metadata = await locator.evaluate(el => ({
      ariaLabel: el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || null,
      title: el.title || null,
      name: el.name || null,
      type: el.type || null
    })).catch(() => ({}));

    const innerText = await locator.innerText().catch(() => "");
    const text = innerText.trim() || metadata.ariaLabel || metadata.title || "button";
    if (!text) continue;

    registerElement(id, page.locator(`[data-kairos-id="${id}"]`), text, "button");

    const enabled = await locator.isEnabled().catch(() => true);
    const box = await locator.boundingBox().catch(() => null);
    const visualInfo = box ? {
      inViewport: box.y >= 0 && box.y < viewportHeight,
      top: Math.round(box.y),
      left: Math.round(box.x),
      width: Math.round(box.width),
      height: Math.round(box.height)
    } : { inViewport: false, top: null, left: null, width: null, height: null };

    const btnObj = {
      id: parseInt(id, 10),
      text,
      role: "button",
      type: metadata.type,
      ariaLabel: metadata.ariaLabel,
      title: metadata.title,
      name: metadata.name,
      visible: true,
      enabled,
      ...visualInfo
    };
    const cls = classifyElement(btnObj, "button");
    btnObj.purpose = cls.purpose;
    btnObj.confidence = cls.confidence;
    btnObj.semanticType = cls.semanticType;
    buttons.push(btnObj);
  }
  return buttons;
}
