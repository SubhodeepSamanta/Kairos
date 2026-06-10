import { getPage } from "../browser.js";

export async function typeText(text) {

  const page =
    await getPage();

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
  }

  await page.keyboard.type(
    text
  );

  return {
    success: true,
    text
  };
}