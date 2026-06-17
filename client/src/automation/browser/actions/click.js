import { getPage } from "../browser.js";
import {
  getElement,
  getElementInfo
} from "../elements/registry.js";

export async function clickText(
  text,
  element
) {

  const page =
    await getPage();

  const context = page.context();
  const pagesBefore = context.pages().length;

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

    try {
      await locator.click({ timeout: 5000 });
    } catch (err) {
      console.log(`[CLICK] Direct stable ID click failed: "${err.message}". Attempting fallback...`);
      const info = getElementInfo(element);
      if (info && info.text) {
        const fallbacks = [];
        if (info.role === "button") {
          fallbacks.push(`button:has-text("${info.text}")`);
          fallbacks.push(`[role="button"]:has-text("${info.text}")`);
        } else if (info.role === "link") {
          fallbacks.push(`a:has-text("${info.text}")`);
        }
        fallbacks.push(`:text("${info.text}")`);

        let fallbackSuccess = false;
        for (const selector of fallbacks) {
          try {
            console.log(`[CLICK] Fallback selector: "${selector}"`);
            const fallbackLocator = page.locator(selector).first();
            await fallbackLocator.click({ timeout: 3000 });
            fallbackSuccess = true;
            console.log(`[CLICK] Fallback click succeeded: "${selector}"`);
            break;
          } catch (e) {
            // Try next fallback
          }
        }
        if (!fallbackSuccess) {
          return {
            success: false,
            reason: `Click failed and fallbacks failed: ${err.message}`,
            clicked: `element ${element}`
          };
        }
      } else {
        return {
          success: false,
          reason: `Click failed: ${err.message}`,
          clicked: `element ${element}`
        };
      }
    }

    await Promise.race([
      page.waitForNavigation({
        timeout: 5000
      }),
      page.waitForLoadState(
        "networkidle",
        {
          timeout: 5000
        }
      )
    ]).catch(() => {});

    await page
      .waitForLoadState(
        "domcontentloaded",
        {
          timeout: 3000
        }
      )
      .catch(() => {});

    await page.waitForTimeout(1000);
    const pagesAfter = context.pages().length;

    return {
      success: true,
      clicked:
        `element ${element}`,
      newTabOpened: pagesAfter > pagesBefore
    };
  }

  const elements =
    page.locator(
`
button,
a,
input[type='submit'],
input[type='button'],
[role='button'],
[aria-label]
`
    );

  const count =
    await elements.count();

  let target =
    null;

  for (
    let i = 0;
    i < count;
    i++
  ) {

    const candidate =
      elements.nth(i);

    const visible =
      await candidate
        .isVisible()
        .catch(() => false);

    if (!visible) {
      continue;
    }

    const textContent =
      (
        await candidate
          .innerText()
          .catch(() => "") ||

        await candidate
          .getAttribute(
            "aria-label"
          )
          .catch(() => "") ||

        ""
      )
      .trim()
      .toLowerCase();

    const targetText =
      text.toLowerCase();

    if (
      textContent ===
        targetText ||

      textContent.startsWith(
        targetText + " "
      )
    ) {

      target =
        candidate;

      break;
    }
  }

  if (!target) {

    return {
      success: false,
      reason:
        `Could not find ${text}`
    };
  }

  console.log(
    "CLICKING:",
    text
  );

  await target.click();

  await Promise.race([
    page.waitForNavigation({
      timeout: 5000
    }),
    page.waitForLoadState(
      "networkidle",
      {
        timeout: 5000
      }
    )
  ]).catch(() => {});

  await page
    .waitForLoadState(
      "domcontentloaded",
      {
        timeout: 3000
      }
    )
    .catch(() => {});

  await page.waitForTimeout(1000);
  const pagesAfter = context.pages().length;

  return {
    success: true,
    clicked: text,
    newTabOpened: pagesAfter > pagesBefore
  };
}