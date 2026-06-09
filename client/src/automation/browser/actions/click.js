import { getPage } from "../browser.js";

export async function clickText(text) {

  const page = await getPage();

  const clicked = await page.evaluate(
    target => {

      const elements = [
  ...document.querySelectorAll(
    `
    button,
    a,
    input[type='submit'],
    input[type='button'],
    [role='button'],
    [aria-label]
    `
  )
];

      const match = elements.find(el => {

  const textContent =
    (
      el.innerText ||
      el.value ||
      el.getAttribute("aria-label") ||
      ""
    )
    .trim()
    .toLowerCase();

  const targetText =
  target.toLowerCase();

return (
  textContent === targetText ||
  textContent.startsWith(
    targetText + " "
  )
);
});
      if (!match) {
        return false;
      }
console.log(
  "CLICKING:",
  match.tagName,
  match.innerText,
  match.value,
  match.getAttribute("aria-label")
);
      match.click();

      return true;
    },
    text
  );

  if (!clicked) {
    return {
      success: false,
      reason: `Could not find ${text}`
    };
  }

  return {
    success: true,
    clicked: text
  };
}