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

  const getSnapshot = async () => {
    try {
      const url = page.url();
      const title = await page.title().catch(() => "");
      const body = await page.evaluate(() => document.body.innerText).catch(() => "");
      const active = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? { tag: el.tagName, id: el.id, class: el.className, value: el.value || el.textContent || "" } : null;
      }).catch(() => null);
      const media = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("video, audio")).map(el => ({
          paused: el.paused,
          currentTime: el.currentTime,
          volume: el.volume,
          muted: el.muted
        }));
      }).catch(() => []);
      const elementStates = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("button, a, input, [role='button'], [role='link']")).map(el => ({
          expanded: el.getAttribute("aria-expanded"),
          pressed: el.getAttribute("aria-pressed"),
          checked: el.checked || el.getAttribute("aria-checked") || el.getAttribute("checked"),
          selected: el.getAttribute("aria-selected")
        }));
      }).catch(() => []);
      const overlayVisible = await page.evaluate(() => {
        const selectors = ['dialog', '[role="dialog"]', '[role="menu"]', '[role="listbox"]', '.modal', '.overlay', '.dropdown-menu', '.search-suggestions', '.search-suggestions-menu', '#search-suggestions'];
        return selectors.some(sel => {
          try {
            const els = document.querySelectorAll(sel);
            return Array.from(els).some(el => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
            });
          } catch {
            return false;
          }
        });
      }).catch(() => false);
      return { url, title, body, active, media, elementStates, overlayVisible };
    } catch {
      return { url: "", title: "", body: "", active: null, media: [], elementStates: [], overlayVisible: false };
    }
  };

  const before = await getSnapshot();

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
          fallbacks.push(`[role="link"]:has-text("${info.text}")`);
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
    const after = await getSnapshot();
    const pagesAfter = context.pages().length;

    const urlChanged = before.url !== after.url;
    const titleChanged = before.title !== after.title;
    const bodyChanged = before.body !== after.body;
    const tabOpened = pagesAfter > pagesBefore;
    const focusChanged = JSON.stringify(before.active) !== JSON.stringify(after.active);
    const mediaChanged = JSON.stringify(before.media) !== JSON.stringify(after.media);
    const elementStateChanged = JSON.stringify(before.elementStates) !== JSON.stringify(after.elementStates);
    const overlayOpened = !before.overlayVisible && after.overlayVisible;
    const activeElementTagChanged = before.active?.tag !== after.active?.tag;
    const activeElementValueChanged = before.active?.value !== after.active?.value;

    const success = urlChanged || titleChanged || bodyChanged || tabOpened || focusChanged || mediaChanged || elementStateChanged || overlayOpened || activeElementTagChanged || activeElementValueChanged;

    return {
      success,
      clicked:
        `element ${element}`,
      newTabOpened: tabOpened,
      reason: success ? undefined : "Click registered but caused no state changes (URL/DOM/Title/Tab/Focus/Media/Attributes/Overlay/ActiveElement)"
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
[role='link'],
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
  const after = await getSnapshot();
  const pagesAfter = context.pages().length;

  const urlChanged = before.url !== after.url;
  const titleChanged = before.title !== after.title;
  const bodyChanged = before.body !== after.body;
  const tabOpened = pagesAfter > pagesBefore;
  const focusChanged = JSON.stringify(before.active) !== JSON.stringify(after.active);
  const mediaChanged = JSON.stringify(before.media) !== JSON.stringify(after.media);
  const elementStateChanged = JSON.stringify(before.elementStates) !== JSON.stringify(after.elementStates);
  const overlayOpened = !before.overlayVisible && after.overlayVisible;
  const activeElementTagChanged = before.active?.tag !== after.active?.tag;
  const activeElementValueChanged = before.active?.value !== after.active?.value;

  const success = urlChanged || titleChanged || bodyChanged || tabOpened || focusChanged || mediaChanged || elementStateChanged || overlayOpened || activeElementTagChanged || activeElementValueChanged;

  return {
    success,
    clicked: text,
    newTabOpened: tabOpened,
    reason: success ? undefined : "Click registered but caused no state changes (URL/DOM/Title/Tab/Focus/Media/Attributes/Overlay/ActiveElement)"
  };
}