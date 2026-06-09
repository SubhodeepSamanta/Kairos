import { getPage } from "../browser.js";

export async function typeText(text) {

  const page = await getPage();

const active = await page.evaluate(() => {
  return document.activeElement?.tagName;
});

if (!active || active === "BODY") {
  const input = page.locator(
    'input, textarea, [contenteditable="true"]'
  ).first();

  if (await input.count()) {
    await input.click();
  }
}

await page.keyboard.type(text);
  return {
    success: true,
    text
  };
}

