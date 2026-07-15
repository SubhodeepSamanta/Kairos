
export async function readLinks(page) {
  const links = [];
  const linkLocators = page.locator("a, [role='link']");
  const linkCount = await linkLocators.count().catch(() => 0);

  const viewportHeight = await page.evaluate(() => window.innerHeight).catch(() => 800);

  for (let i = 0; i < linkCount; i++) {
    const locator = linkLocators.nth(i);
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    const metadata = await locator.evaluate(el => ({
      ariaLabel: el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || null,
      title: el.title || null,
      href: el.getAttribute("href") || null,
      role: el.getAttribute("role") || "link"
    })).catch(() => ({}));

    const innerText = await locator.innerText().catch(() => "");
    const text = innerText.trim() || metadata.ariaLabel || metadata.title || "link";
    if (!text) continue;

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
      text,
      role: metadata.role,
      href: metadata.href,
      ariaLabel: metadata.ariaLabel,
      title: metadata.title,
      visible: true,
      enabled,
      ...visualInfo
    };
    links.push(linkObj);
  }
  return links;
}
