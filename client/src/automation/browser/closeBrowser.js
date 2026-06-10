import { closeBrowser } from "../browser/browser.js";

export async function closeCurrentBrowser() {

  await closeBrowser();

  return {
    success: true
  };
}