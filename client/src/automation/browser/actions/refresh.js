import { getPage } from "../browser.js";

export async function refreshPage() {

  const page =
    await getPage();

  await page.reload();

  return {
    success: true
  };
}