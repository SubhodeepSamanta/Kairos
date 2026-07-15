const INTERACTIVE_ROLES = new Set([
  "button", "link", "searchbox", "textbox", "combobox",
  "checkbox", "radio", "switch", "tab", "menuitem",
  "option", "listbox", "spinbutton", "slider",
  "menuitemcheckbox", "menuitemradio", "treeitem"
]);

const LINE = /^(\s*)-\s+([a-zA-Z]+)(?:\s+"((?:[^"\\]|\\.)*)")?((?:\s*\[[^\]]+\])*)\s*:?\s*(.*)$/;

export function parseAriaSnapshot(yaml) {
  const nodes = [];
  for (const raw of String(yaml || "").split("\n")) {
    const match = raw.match(LINE);
    if (!match) continue;

    const [, , role, rawName = "", rawAttrs = "", trailing = ""] = match;
    if (!INTERACTIVE_ROLES.has(role)) continue;

    const name = rawName.replace(/\\"/g, '"').trim();
    const attrs = rawAttrs || "";
    const value = trailing && !trailing.startsWith("/") ? trailing.trim() : "";

    nodes.push({
      role,
      name,
      value: value && value !== "-" ? value : "",
      disabled: /\[disabled\]/.test(attrs),
      checked: /\[checked\]/.test(attrs),
      level: /\[level=(\d+)\]/.exec(attrs)?.[1] || null
    });
  }
  return nodes;
}

export async function readAriaElements(page) {
  let yaml;
  try {
    yaml = await page.locator("body").ariaSnapshot({ timeout: 5000 });
  } catch {
    return [];
  }

  const nodes = parseAriaSnapshot(yaml);
  const elements = [];
  const seen = new Map();

  for (const node of nodes) {
    if (!node.name) continue;

    const key = `${node.role}:${node.name}`;
    const occurrence = seen.get(key) || 0;
    seen.set(key, occurrence + 1);

    try {
      const locator = page.getByRole(node.role, { name: node.name, exact: true }).nth(occurrence);
      if (!(await locator.isVisible().catch(() => false))) continue;

      const box = await locator.boundingBox().catch(() => null);
      const enabled = node.disabled ? false : await locator.isEnabled().catch(() => true);

      elements.push({
        role: node.role,
        name: node.name,
        locator,
        visualInfo: box
          ? { inViewport: true, top: Math.round(box.y), left: Math.round(box.x), width: Math.round(box.width), height: Math.round(box.height) }
          : { inViewport: false, top: null, left: null, width: null, height: null },
        enabled,
        value: node.value || null,
        checked: node.checked
      });
    } catch {
      continue;
    }
  }

  return elements;
}
