import { getPage } from "../browser.js";

export async function createSnapshot() {

  const page = await getPage();

  return {
    url: page.url(),
    title: await page.title()
  };
}