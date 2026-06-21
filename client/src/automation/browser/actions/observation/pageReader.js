export async function preparePage(page) {
  await page.evaluate(() => {
    document.querySelectorAll("[data-kairos-id]").forEach(el => {
      el.removeAttribute("data-kairos-id");
    });
    window.__kairosNextId = 1;
    const selectors = [
      "button:not([disabled])",
      "input:not([type='hidden']):not([disabled])",
      "textarea:not([disabled])",
      "a",
      "form",
      "[role='button']",
      "[role='link']",
      "[contenteditable='true']"
    ];
    const elements = document.querySelectorAll(selectors.join(", "));
    elements.forEach(el => {
      if (!el.getAttribute("data-kairos-id")) {
        el.setAttribute("data-kairos-id", String(window.__kairosNextId++)); 
      }
    });
  }).catch(() => {});
}

export async function extractPageText(page) {
  return await page.evaluate(() => {
    return document.body.innerText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
  }).catch(() => "");
}
