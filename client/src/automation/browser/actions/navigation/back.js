import { getPage } from "../../browser.js";

export async function goBack() {
  const page = await getPage();
  await page.goBack();
  return { success: true };
}
