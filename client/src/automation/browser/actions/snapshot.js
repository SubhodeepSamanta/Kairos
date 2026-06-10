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

    return {
      url: page.url(),
      title: await page.title()
    };

  } catch {

    return {
      url: null,
      title: null
    };
  }
}