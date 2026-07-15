import { registerElement } from "../../elements/registry.js";

const INTERACTIVE_ROLES = new Set([
  "button", "link", "searchbox", "textbox", "combobox",
  "checkbox", "radio", "switch", "tab", "menuitem",
  "option", "listbox", "spinbutton", "slider"
]);

export async function readFrames(page) {
  const frameElements = [];
  const iframes = await page.locator("iframe, frame").all().catch(() => []);

  for (let fi = 0; fi < iframes.length; fi++) {
    const iframeLoc = iframes[fi];
    const frameSrc = await iframeLoc.getAttribute("src").catch(() => "");
    const frameId = `frame:${fi}`;

    const frame = await page.frame({ name: frameId }).catch(() => null) ||
                  await page.frames().find(f => f.url().includes(frameSrc) || f.name() === `frame-${fi}`) ||
                  null;
    if (!frame) continue;

    const snapshot = await frame.accessibility?.snapshot().catch(() => null);
    if (snapshot) {
      const nodes = flattenTree(snapshot);
      for (const node of nodes) {
        if (!INTERACTIVE_ROLES.has(node.role)) continue;
        try {
          const locator = frame.getByRole(node.role, { name: node.name, exact: true }).first();
          const visible = await locator.isVisible().catch(() => false);
          if (!visible) continue;
          const box = await locator.boundingBox().catch(() => null);
          frameElements.push({
            frameId, role: node.role, text: node.name,
            value: node.value || null, visible: true, enabled: !node.disabled,
            locator,
            visualInfo: box ? {
              inViewport: true,
              top: Math.round(box.y), left: Math.round(box.x),
              width: Math.round(box.width), height: Math.round(box.height)
            } : { inViewport: false, top: null, left: null, width: null, height: null }
          });
        } catch {}
      }
    }

    const buttons = await readFrameElements(frame, "button:not([disabled]), [role='button']", "button").catch(() => []);
    const inputs = await readFrameElements(frame, "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), [contenteditable='true']", "input").catch(() => []);
    const links = await readFrameElements(frame, "a, [role='link']", "link").catch(() => []);

    for (const el of [...buttons, ...inputs, ...links]) {
      const exists = frameElements.some(e =>
        e.role === el.role && e.text === el.text && e.frameId === frameId
      );
      if (!exists) frameElements.push({ ...el, frameId });
    }
  }

  return frameElements;
}

async function readFrameElements(frame, selector, role) {
  const results = [];
  const locators = frame.locator(selector);
  const count = await locators.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const loc = locators.nth(i);
    const visible = await loc.isVisible().catch(() => false);
    if (!visible) continue;
    const text = await loc.innerText().catch(() => "");
    if (!text && role !== "input") continue;
    const box = await loc.boundingBox().catch(() => null);
    const href = role === "link" ? await loc.getAttribute("href").catch(() => null) : null;
    results.push({
      role, text: text.trim() || `${role}-${i}`,
      href, visible: true, enabled: true,
      locator: loc,
      visualInfo: box ? {
        inViewport: true,
        top: Math.round(box.y), left: Math.round(box.x),
        width: Math.round(box.width), height: Math.round(box.height)
      } : { inViewport: false, top: null, left: null, width: null, height: null }
    });
  }
  return results;
}

function flattenTree(node, depth = 0, maxDepth = 8) {
  if (!node || depth > maxDepth) return [];
  const result = [];
  const role = (node.role || "").toLowerCase();
  const name = (node.name || "").trim();
  if (role && name) {
    result.push({ role, name, value: node.value, disabled: node.disabled === true });
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      result.push(...flattenTree(child, depth + 1, maxDepth));
    }
  }
  return result;
}
