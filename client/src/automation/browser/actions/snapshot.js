import {
  getCurrentPage,
  isBrowserOpen
} from "../browser.js";

export async function createSnapshot() {

  if (!isBrowserOpen()) {

    return {
      url: null,
      title: null
    };
  }

  const page =
    getCurrentPage();

  try {
    const context = page.context();
    return {
      url: page.url(),
      title: await page.title(),
      tabCount: context.pages().length
    };

  } catch {

    return {
      url: null,
      title: null,
      tabCount: 0
    };
  }
}