import { getPage } from "../browser.js";
import { updateBrowserContext } from "../context.js";
import {
  clearRegistry,
  registerElement
} from "../elements/registry.js";

export async function readPage() {

  const page = await getPage();

  const title = await page.title();
  const url = page.url();
  clearRegistry();

const buttons = [];

const buttonLocators =
  page.locator("button");

const buttonCount =
  await buttonLocators.count();

for (
  let i = 0;
  i < buttonCount;
  i++
) {

  const locator =
    buttonLocators.nth(i);

  const visible =
    await locator
      .isVisible()
      .catch(() => false);

  if (!visible) {
    continue;
  }

  const text =
    await locator
      .innerText()
      .catch(() => "");

  if (!text.trim()) {
    continue;
  }

  const id =
    registerElement(
      locator
    );

  buttons.push({
    id,
    text
  });
}

const inputs = [];

const inputLocators =
  page.locator(
    "input, textarea"
  );

const inputCount =
  await inputLocators.count();

for (
  let i = 0;
  i < inputCount;
  i++
) {

  const locator =
    inputLocators.nth(i);

  const visible =
    await locator
      .isVisible()
      .catch(() => false);

  if (!visible) {
    continue;
  }

  const label =
    await locator.evaluate(el => {

      return (
        el.placeholder ||
        el.name ||
        el.type ||
        "input"
      );
    });

  const id =
    registerElement(
      locator
    );

  inputs.push({
    id,
    text: label
  });
}
const links = [];

const linkLocators =
  page.locator("a");

const linkCount =
  await linkLocators.count();

for (
  let i = 0;
  i < linkCount;
  i++
) {

  const locator =
    linkLocators.nth(i);

  const visible =
    await locator
      .isVisible()
      .catch(() => false);

  if (!visible) {
    continue;
  }

  const text =
    await locator
      .innerText()
      .catch(() => "");

  if (!text.trim()) {
    continue;
  }

  const id =
    registerElement(
      locator
    );

  links.push({
    id,
    text
  });
}

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
console.log(
  "INPUTS:",
  JSON.stringify(
    inputs,
    null,
    2
  )
);
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