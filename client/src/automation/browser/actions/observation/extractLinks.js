import { getPage } from "../../browser.js";

export async function extractLinks() {
  const page = await getPage();

  const links = await page.$$eval(
    "a",
    anchors =>
      anchors
        .map(a => ({
          text: a.innerText.trim(),
          href: a.href
        }))
        .filter(link => link.text)
  );

  return {
    success: true,
    links
  };
}
