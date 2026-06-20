import { registerElement } from "../../elements/registry.js";

export async function readForms(page) {
  const forms = [];
  const formLocators = page.locator("form");
  const formCount = await formLocators.count().catch(() => 0);

  for (let i = 0; i < formCount; i++) {
    const locator = formLocators.nth(i);
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    const id = await locator.getAttribute("data-kairos-id").catch(() => null);
    if (!id) continue;

    const metadata = await locator.evaluate(el => ({
      id: el.id || null,
      action: el.action || null,
      method: el.method || null,
      role: el.getAttribute("role") || "form"
    })).catch(() => ({}));

    registerElement(id, page.locator(`[data-kairos-id="${id}"]`), null, "form");

    forms.push({
      id: parseInt(id, 10),
      role: metadata.role,
      action: metadata.action,
      method: metadata.method,
      visible: true
    });
  }
  return forms;
}
