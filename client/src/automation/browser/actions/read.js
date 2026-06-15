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
  page.locator("button:not([disabled])");

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

  const enabled =
  await locator
    .isEnabled()
    .catch(() => true);

buttons.push({
  id,
  text,

  role: "button",

  visible: true,

  enabled
});
}

const inputs = [];

const inputLocators =
  page.locator(
    "input:not([type='hidden']):not([disabled]), textarea:not([disabled])"
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

  const metadata =
  await locator.evaluate(el => ({

    placeholder:
      el.placeholder || null,

    name:
      el.name || null,

    type:
      el.type || null,

    value:
      el.value || null

  }));

  const id =
    registerElement(
      locator
    );

  const enabled =
  await locator
    .isEnabled()
    .catch(() => true);

  inputs.push({
    id,

    text:
      metadata.placeholder ||
      metadata.name ||
      metadata.type ||
      "input",

    value:
      metadata.value || "",

    role: "input",

    placeholder:
      metadata.placeholder,

    visible: true,

    enabled
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

  const enabled =
  await locator
    .isEnabled()
    .catch(() => true);

links.push({
  id,
  text,

  role: "link",

  visible: true,

  enabled
});
}

const forms = [];

const formLocators =
  page.locator("form");

const formCount =
  await formLocators.count();

for (
  let i = 0;
  i < formCount;
  i++
) {

  const locator =
    formLocators.nth(i);

  const visible =
    await locator
      .isVisible()
      .catch(() => false);

  if (!visible) {
    continue;
  }

  const metadata =
  await locator.evaluate(el => ({
    id: el.id || null,
    action: el.action || null,
    method: el.method || null,
    role: el.getAttribute("role") || "form"
  }));

  const id =
    registerElement(
      locator
    );

  forms.push({
    id,
    role: metadata.role,
    action: metadata.action,
    method: metadata.method,
    visible: true
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
    forms,
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
console.log("FORMS:", forms);
  return {
    success: true,
    title,
    url,
    buttons,
    inputs,
    links,
    forms,
    text
  };
}