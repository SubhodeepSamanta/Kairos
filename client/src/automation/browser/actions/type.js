import { getPage } from "../browser.js";
import {
  getElement
} from "../elements/registry.js";

export async function typeText(
  text,
  element
) {

  const page =
    await getPage();
if (element) {

  const locator =
    getElement(
      element
    );

  if (!locator) {

    return {
      success: false,
      reason:
        `Unknown element ${element}`
    };
  }

  await locator.click();

  let success = false;
  let value = null;

  try {
    const tagName = await locator.evaluate(el => el.tagName).catch(() => "");
    if (tagName !== "INPUT" && tagName !== "TEXTAREA") {
      // Targeted a button/link. Wait 600ms for overlay/dropdown/modal to focus.
      await new Promise(r => setTimeout(r, 600));
      const activeInfo = await page.evaluate(() => {
        const el = document.activeElement;
        return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) ? { tag: el.tagName } : null;
      }).catch(() => null);

      if (activeInfo) {
        await page.keyboard.type(text);
        value = await page.evaluate(() => document.activeElement?.value || "").catch(() => null);
        success = value && value.includes(text);
      } else {
        // Fallback to active keyboard typing
        const beforeVal = await page.evaluate(() => document.activeElement?.value || document.activeElement?.textContent || "").catch(() => "");
        await page.keyboard.type(text);
        value = await page.evaluate(() => document.activeElement?.value || document.activeElement?.textContent || "").catch(() => null);
        success = (value && value.includes(text)) || (value !== beforeVal);
      }
    } else {
      await locator.fill(text);
      value = await locator.inputValue().catch(() => null);
      success = (value === text);
    }
  } catch (err) {
    // Fallback to keyboard typing if fill/evaluation fails
    try {
      const beforeVal = await page.evaluate(() => document.activeElement?.value || "").catch(() => "");
      await page.keyboard.type(text);
      const afterVal = await page.evaluate(() => document.activeElement?.value || "").catch(() => "");
      success = (afterVal && afterVal.includes(text)) || (afterVal !== beforeVal);
    } catch {
      success = true;
    }
  }

  return {
    success,
    text,
    element,
    actualValue: value
  };
}
const active =
  await page.evaluate(() => {

    const element =
      document.activeElement;

    if (!element) {
      return null;
    }

    return {
      tag:
        element.tagName,
      contentEditable:
        element.isContentEditable,
      type:
        element.type || null,
      placeholder:
        element.placeholder || null
    };
  });

console.log(
  "ACTIVE ELEMENT:",
  active
);

const hasFocusedInput =

  active && (

    active.tag === "INPUT" ||

    active.tag === "TEXTAREA" ||

    active.contentEditable
  );

  if (!hasFocusedInput) {

    const inputs =
      page.locator(
        'input, textarea, [contenteditable="true"]'
      );

    const count =
      await inputs.count();

    let target =
      null;

    for (
      let i = 0;
      i < count;
      i++
    ) {

      const candidate =
        inputs.nth(i);

      const visible =
        await candidate
          .isVisible()
          .catch(() => false);

      if (!visible) {
        continue;
      }

      const type =
        await candidate
          .getAttribute("type");

      if (
        type === "hidden"
      ) {
        continue;
      }

      target =
        candidate;

      break;
    }

    if (!target) {

      return {
        success: false,
        reason:
          "no_visible_input"
      };
    }

    await target.click();

console.log(
  "FOCUSED INPUT:",
  await target.evaluate(el => ({
    tag: el.tagName,
    type: el.type,
    placeholder: el.placeholder
  }))
);
await target.fill(
  text
);

const value =
  await target
    .inputValue()
    .catch(() => null);

return {
  success:
    value === text,

  text,

  actualValue:
    value
};
  }
await page.keyboard.type(
  text
);

const value =
  await page.evaluate(() => {

    const el =
      document.activeElement;

    return el?.value || "";
  });

return {
  success:
    value.includes(text),

  text,

  actualValue:
    value
};
  
}