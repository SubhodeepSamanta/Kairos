import { classifyElement } from "../classifier/index.js";

export async function readInputs(page) {
  const inputs = [];
  const inputLocators = page.locator("input:not([type='hidden']):not([disabled]), textarea:not([disabled]), [contenteditable='true']");
  const inputCount = await inputLocators.count().catch(() => 0);

  const viewportHeight = await page.evaluate(() => window.innerHeight).catch(() => 800);

  for (let i = 0; i < inputCount; i++) {
    const locator = inputLocators.nth(i);
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    const metadata = await locator.evaluate(el => ({
      placeholder: el.placeholder || null,
      name: el.name || null,
      type: el.type || null,
      value: el.value || null,
      ariaLabel: el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || null,
      title: el.title || null,
      role: el.getAttribute("role") || null
    })).catch(() => ({}));

    const text = metadata.ariaLabel || metadata.placeholder || metadata.name || metadata.type || "input";

    const enabled = await locator.isEnabled().catch(() => true);
    const box = await locator.boundingBox().catch(() => null);
    const visualInfo = box ? {
      inViewport: box.y >= 0 && box.y < viewportHeight,
      top: Math.round(box.y),
      left: Math.round(box.x),
      width: Math.round(box.width),
      height: Math.round(box.height)
    } : { inViewport: false, top: null, left: null, width: null, height: null };

    const inputObj = {
      text,
      value: metadata.value || "",
      role: metadata.role || "input",
      type: metadata.type,
      placeholder: metadata.placeholder,
      ariaLabel: metadata.ariaLabel,
      name: metadata.name,
      title: metadata.title,
      visible: true,
      enabled,
      ...visualInfo
    };
    const cls = classifyElement(inputObj, "input");
    inputObj.purpose = cls.purpose;
    inputObj.confidence = cls.confidence;
    inputObj.semanticType = cls.semanticType;
    inputs.push(inputObj);
  }
  return inputs;
}
