import { restartBrowser } from "../browser/browser.js";

export async function restartCurrentBrowser() {

  await restartBrowser();

  return {
    success: true
  };
}