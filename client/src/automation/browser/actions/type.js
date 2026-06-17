import { getPage } from "../browser.js";
import { getElement } from "../elements/registry.js";

export async function typeText(text, element) {
  const page = await getPage();

  const getActiveElementInfo = async () => {
    return await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return {
        tag: el.tagName,
        isContentEditable: el.isContentEditable,
        value: el.value || el.textContent || ""
      };
    }).catch(() => null);
  };

  let success = false;
  let value = null;

  if (element) {
    const locator = getElement(element);
    if (!locator) {
      return {
        success: false,
        reason: `Unknown element ${element}`
      };
    }

    try {
      const tagName = await locator.evaluate(el => el.tagName).catch(() => "");
      const isEditable = await locator.evaluate(el => el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA").catch(() => false);

      if (tagName !== "INPUT" && tagName !== "TEXTAREA" && !isEditable) {
        // Targeted a launcher button/link. Click it first.
        await locator.click();
        // Wait 600ms for overlay/modal to focus
        await new Promise(r => setTimeout(r, 600));
        
        const active = await getActiveElementInfo();
        if (active && (active.tag === "INPUT" || active.tag === "TEXTAREA" || active.isContentEditable)) {
          await page.keyboard.type(text);
          const afterActive = await getActiveElementInfo();
          value = afterActive?.value || "";
          success = value.includes(text);
        } else {
          return {
            success: false,
            reason: "Clicked launcher, but focus did not transition to an input/textarea/contenteditable element."
          };
        }
      } else {
        // It's a direct input element. Focus & fill it.
        await locator.focus().catch(() => {});
        await locator.fill(text);
        value = await locator.inputValue().catch(() => null);
        success = (value === text);
      }
    } catch (err) {
      const active = await getActiveElementInfo();
      if (active && (active.tag === "INPUT" || active.tag === "TEXTAREA" || active.isContentEditable)) {
        await page.keyboard.type(text).catch(() => {});
        const afterActive = await getActiveElementInfo();
        value = afterActive?.value || "";
        success = value.includes(text) || value !== active.value;
      } else {
        success = false;
      }
    }
  } else {
    // No element specified: check active focus
    const active = await getActiveElementInfo();
    const hasFocusedInput = active && (active.tag === "INPUT" || active.tag === "TEXTAREA" || active.isContentEditable);

    if (hasFocusedInput) {
      await page.keyboard.type(text);
      const afterActive = await getActiveElementInfo();
      value = afterActive?.value || "";
      success = value.includes(text);
    } else {
      // Find the first visible input on the page
      const inputs = page.locator('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"]');
      const count = await inputs.count().catch(() => 0);
      let target = null;

      for (let i = 0; i < count; i++) {
        const candidate = inputs.nth(i);
        const visible = await candidate.isVisible().catch(() => false);
        if (visible) {
          target = candidate;
          break;
        }
      }

      if (!target) {
        return {
          success: false,
          reason: "No active input focused and no visible input elements found on the page."
        };
      }

      await target.click();
      await target.fill(text);
      value = await target.inputValue().catch(() => null);
      success = (value === text);
    }
  }

  return {
    success,
    text,
    element,
    actualValue: value
  };
}