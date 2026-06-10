import { getPage } from "../browser.js";

export async function pressKey(
  key
) {

  const page =
    await getPage();

  await page.keyboard.press(
    key
  );

  return {
    success: true,
    key
  };
}