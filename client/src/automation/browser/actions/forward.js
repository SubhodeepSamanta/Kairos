import { getPage } from "../browser.js";

export async function goForward() {

  const page =
    await getPage();

  await page.goForward();

  return {
    success: true
  };
}