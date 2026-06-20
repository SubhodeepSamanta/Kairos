import fs from "fs";
import path from "path";
import { getPage } from "../../browser.js";

export async function takeScreenshot() {
  const page = await getPage();
  const dir = "screenshots";

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  const filePath = path.join(
    dir,
    `screenshot-${Date.now()}.png`
  );

  await page.screenshot({
    path: filePath,
    fullPage: true
  });

  return {
    success: true,
    path: filePath
  };
}
