import { registerElement } from "../../elements/registry.js";
import { classifyElement } from "../classifier/index.js";

export async function readLinks(page) {
  const links = [];
  const linkLocators = page.locator("a, [role='link']");
  const linkCount = await linkLocators.count().catch(() => 0);

  const viewportHeight = await page.evaluate(() => window.innerHeight).catch(() => 800);

  for (let i = 0; i < linkCount; i++) {
    const locator = linkLocators.nth(i);
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    const id = await locator.getAttribute("data-kairos-id").catch(() => null);
    if (!id) continue;

    const metadata = await locator.evaluate(el => ({
      ariaLabel: el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || null,
      title: el.title || null,
      href: el.getAttribute("href") || null
    })).catch(() => ({}));

    const innerText = await locator.innerText().catch(() => "");
    const text = innerText.trim() || metadata.ariaLabel || metadata.title || "link";
    if (!text) continue;

    registerElement(id, page.locator(`[data-kairos-id="${id}"]`), text, "link");

    const enabled = await locator.isEnabled().catch(() => true);
    const box = await locator.boundingBox().catch(() => null);
    const visualInfo = box ? {
      inViewport: box.y >= 0 && box.y < viewportHeight,
      top: Math.round(box.y),
      left: Math.round(box.x),
      width: Math.round(box.width),
      height: Math.round(box.height)
    } : { inViewport: false, top: null, left: null, width: null, height: null };

    const linkObj = {
      id: parseInt(id, 10),
      text,
      role: "link",
      href: metadata.href,
      ariaLabel: metadata.ariaLabel,
      title: metadata.title,
      visible: true,
      enabled,
      ...visualInfo
    };
    const cls = classifyElement(linkObj, "link");
    linkObj.purpose = cls.purpose;
    linkObj.confidence = cls.confidence;
    linkObj.semanticType = cls.semanticType;
    links.push(linkObj);
  }
  return links;
}
