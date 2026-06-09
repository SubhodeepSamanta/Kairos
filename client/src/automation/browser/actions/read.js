import { getPage } from "../browser.js";
import { updateBrowserContext } from "../context.js";

export async function readPage() {

  const page = await getPage();

  const title = await page.title();
  const url = page.url();

  const text = await page.evaluate(() => {
    return document.body.innerText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);
  });

  updateBrowserContext({
    title,
    url,
    content: text
  });

  return {
    success: true,
    url,
    title,
    text
  };
}