import { getPage } from "../browser.js";
import {
  getElement
} from "../elements/registry.js";

export async function clickText(
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

    return {
      success: true,
      clicked:
        `element ${element}`
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

  return {
    success: true,
    clicked: text
  };
}