import { getPage } from "../browser.js";
import { updateBrowserContext } from "../context.js";

export async function navigate(url) {

  const page = await getPage();

  await page.goto(url);

  const title = await page.title();
  const currentUrl = page.url();

  updateBrowserContext({
    title,
    url: currentUrl
  });

  return {
    success: true,
    title,
    url: currentUrl
  };
}