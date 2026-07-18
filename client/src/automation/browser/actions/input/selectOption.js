import { getPage } from "../../browser.js";
import { getElement } from "../../elements/registry.js";
import { thinkBeforeAction, moveToElement, pause } from "../../humanize.js";

export async function selectOption(element, value) {
  const page = await getPage();
  if (!page) return { success: false, reason: "No page available" };

  const wanted = String(value || "").trim();
  if (!wanted) return { success: false, reason: "select_option needs a value" };

  const locator = getElement(element);
  if (!locator) {
    return { success: false, reason: `Unknown element ${element} — read the page again for fresh ids` };
  }

  await thinkBeforeAction();
  await locator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await moveToElement(page, locator);

  try {
    await locator.selectOption({ label: wanted }, { timeout: 3000 });
    return { success: true, selected: wanted };
  } catch {}
  try {
    await locator.selectOption(wanted, { timeout: 3000 });
    return { success: true, selected: wanted };
  } catch {}

  try {
    await locator.click({ timeout: 4000 });
    await pause(250, 600);
    const escaped = wanted.replace(/"/g, '\\"');
    const option = page
      .locator(`[role="option"]:has-text("${escaped}"), [role="menuitem"]:has-text("${escaped}"), li:has-text("${escaped}")`)
      .first();
    await option.click({ timeout: 4000 });
    return { success: true, selected: wanted, custom: true };
  } catch (err) {
    await page.keyboard.press("Escape").catch(() => {});
    return {
      success: false,
      reason: `Could not select "${wanted}": ${err.message.slice(0, 120)}. Check the exact option label in the snapshot.`
    };
  }
}
