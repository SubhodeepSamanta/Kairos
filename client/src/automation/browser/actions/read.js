import { getPage } from "../browser.js";
import { updateBrowserContext } from "../context.js";

export async function readPage() {

  const page = await getPage();

  const title = await page.title();
  const url = page.url();

  const buttons = await page.evaluate(() => {
    return [...document.querySelectorAll("button")]
      .map(button => button.innerText?.trim())
      .filter(Boolean)
      .slice(0, 50);
  });

  const inputs = await page.evaluate(() => {
    return [...document.querySelectorAll("input, textarea")]
      .map(input =>
        input.placeholder ||
        input.name ||
        input.type ||
        "input"
      )
      .filter(Boolean)
      .slice(0, 50);
  });

  const links = await page.evaluate(() => {
    return [...document.querySelectorAll("a")]
      .map(link => link.innerText?.trim())
      .filter(Boolean)
      .slice(0, 50);
  });

  const text = await page.evaluate(() => {
    return document.body.innerText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
  });

  updateBrowserContext({
    title,
    url,
    buttons,
    inputs,
    links,
    text
  });
console.log("BUTTONS:", buttons);
console.log("INPUTS:", inputs);
console.log("LINKS:", links);
  return {
    success: true,
    title,
    url,
    buttons,
    inputs,
    links,
    text
  };
}