import { getPage } from "../../browser.js";
import { getElement } from "../../elements/registry.js";
import { resolveSecrets } from "../../../../secrets/vault.js";
import { humanType, moveToElement, thinkBeforeAction, pause } from "../../humanize.js";

export async function typeText(rawText, element, submit = false) {
  const page = await getPage();
  if (!page) return { success: false, reason: "No page available" };

  const { resolved: text, missing, containedSecret } = resolveSecrets(rawText);
  if (missing.length) {
    return { success: false, reason: `missing_secret:${missing.join(",")} — ask the user for it with ask_human and secret_name` };
  }
  const display = containedSecret ? "•••••" : text;

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
      return { success: false, reason: `Unknown element ${element} — read the page again for fresh ids` };
    }

    try {
      const tagName = await locator.evaluate(el => el.tagName).catch(() => "");
      const isEditable = await locator.evaluate(el => el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA").catch(() => false);

      if (tagName !== "INPUT" && tagName !== "TEXTAREA" && !isEditable) {
        await locator.click();
        await new Promise(r => setTimeout(r, 800));

        let active = null;
        const startTime = Date.now();
        while (Date.now() - startTime < 3000) {
          active = await getActiveElementInfo();
          if (active && (active.tag === "INPUT" || active.tag === "TEXTAREA" || active.isContentEditable)) break;
          await new Promise(r => setTimeout(r, 200));
        }

        if (active && (active.tag === "INPUT" || active.tag === "TEXTAREA" || active.isContentEditable)) {
          await humanType(page, null, text);
          const afterActive = await getActiveElementInfo();
          value = afterActive?.value || "";
          success = value.includes(text);
        } else {
          return { success: false, reason: "Clicked the element but focus never moved to a text field" };
        }
      } else {
        await thinkBeforeAction();
        await locator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await moveToElement(page, locator);
        await locator.click({ timeout: 4000 }).catch(() => locator.focus().catch(() => {}));
        await locator.fill("").catch(() => {});
        await humanType(page, locator, text);
        value = await locator.inputValue().catch(() => null);
        success = (value === text);
      }
    } catch {
      const active = await getActiveElementInfo();
      if (active && (active.tag === "INPUT" || active.tag === "TEXTAREA" || active.isContentEditable)) {
        await humanType(page, null, text).catch(() => {});
        const afterActive = await getActiveElementInfo();
        value = afterActive?.value || "";
        success = value.includes(text) || value !== active.value;
      } else {
        success = false;
      }
    }
  } else {
    const active = await getActiveElementInfo();
    const hasFocusedInput = active && (active.tag === "INPUT" || active.tag === "TEXTAREA" || active.isContentEditable);

    if (hasFocusedInput) {
      await humanType(page, null, text);
      const afterActive = await getActiveElementInfo();
      value = afterActive?.value || "";
      success = value.includes(text);
    } else {
      const inputs = page.locator('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"]');
      const count = await inputs.count().catch(() => 0);
      let target = null;
      for (let i = 0; i < count; i++) {
        const candidate = inputs.nth(i);
        if (await candidate.isVisible().catch(() => false)) {
          target = candidate;
          break;
        }
      }
      if (!target) {
        return { success: false, reason: "No focused input and no visible input elements on the page" };
      }
      await moveToElement(page, target);
      await target.click();
      await humanType(page, target, text);
      value = await target.inputValue().catch(() => null);
      success = (value === text);
    }
  }

  if (success && submit) {
    await pause(180, 450);
    await page.keyboard.press("Enter").catch(() => {});
  }

  return {
    success,
    text: display,
    element,
    submitted: success && submit,
    actualValue: containedSecret ? "•••••" : value
  };
}
