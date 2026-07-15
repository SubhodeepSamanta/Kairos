import { getPage } from "../../browser.js";
import { createSnapshot } from "../snapshot.js";

export async function pressKey(
  key
) {
  const page = await getPage();
  if (!page) return { success: false, reason: "No page available" };
  const before = await createSnapshot();
  const beforeUrl = page.url();

  await page.keyboard.press(key);

  await Promise.race([
    page.waitForNavigation({ timeout: 5000 }),
    page.waitForLoadState("networkidle", { timeout: 5000 }),
    page.waitForFunction(
      oldUrl => location.href !== oldUrl,
      beforeUrl,
      { timeout: 5000 }
    )
  ]).catch(err => console.error("[pressKey] Navigation wait failed:", err.message));

  const after = await createSnapshot();

  return {
    success: true,
    key,
    before,
    after
  };
}
