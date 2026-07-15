export async function extractPageText(page) {
  return await page.evaluate(() => {
    return document.body.innerText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
  }).catch(() => "");
}
