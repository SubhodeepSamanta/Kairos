import { getPage } from "../browser.js";
import { humanScroll } from "../humanize.js";

export async function scrollPage(direction) {
  const page = await getPage();
  const beforeY = await page.evaluate(() => window.scrollY).catch(() => 0);

  await humanScroll(page, direction, 800);

  const afterY = await page.evaluate(() => window.scrollY).catch(() => 0);

  return {
    success: true,
    direction,
    beforeY,
    afterY,
    reachedEdge: beforeY === afterY
  };
}
