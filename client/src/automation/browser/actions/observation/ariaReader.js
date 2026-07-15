const INTERACTIVE_ROLES = new Set([
  "button", "link", "searchbox", "textbox", "combobox",
  "checkbox", "radio", "switch", "tab", "menuitem",
  "option", "listbox", "spinbutton", "slider",
  "menuitemcheckbox", "menuitemradio", "treeitem"
]);

function flattenTree(node, depth = 0, maxDepth = 8) {
  if (!node || depth > maxDepth) return [];
  const result = [];
  const role = (node.role || "").toLowerCase();
  const name = (node.name || "").trim();
  if (role && name) {
    result.push({
      role,
      name,
      value: node.value,
      focused: node.focused === true,
      disabled: node.disabled === true,
      checked: node.checked === true
    });
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      result.push(...flattenTree(child, depth + 1, maxDepth));
    }
  }
  return result;
}

export async function readAriaElements(page) {
  const snapshot = await page.accessibility?.snapshot().catch(() => null);
  if (!snapshot) return [];

  const nodes = flattenTree(snapshot);
  const interactive = nodes.filter(n => INTERACTIVE_ROLES.has(n.role));

  const elements = [];
  const seen = new Set();

  for (const node of interactive) {
    const key = `${node.role}:${node.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      const locator = page.getByRole(node.role, { name: node.name, exact: true }).first();
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) continue;

      const box = await locator.boundingBox().catch(() => null);
      const visualInfo = box ? {
        inViewport: true,
        top: Math.round(box.y),
        left: Math.round(box.x),
        width: Math.round(box.width),
        height: Math.round(box.height)
      } : { inViewport: false, top: null, left: null, width: null, height: null };

      const enabled = await locator.isEnabled().catch(() => true);

      elements.push({
        role: node.role,
        name: node.name,
        locator,
        visualInfo,
        enabled: enabled && !node.disabled,
        value: node.value || null,
        focused: node.focused,
        checked: node.checked
      });
    } catch {
      continue;
    }
  }

  return elements;
}
