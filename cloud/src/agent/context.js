import {
  getBrowserState
} from "./state.js";

const MAX_INPUTS = 20;
const MAX_BUTTONS = 30;
const MAX_LINKS = 30;

export function buildBrowserContext() {

  const browser =
    getBrowserState();

  if (!browser) {
    return "";
  }

  let context = "";

  if (browser.url) {
    context += `URL:\n${browser.url}\n\n`;
  }

  if (browser.title) {
    context += `Title:\n${browser.title}\n\n`;
  }

  if (browser.inputs?.length) {

    context += "Inputs:\n";

    for (
  const input of
  browser.inputs
    .slice(0, MAX_INPUTS)
) {
      context +=
        `[${input.id}] ${input.text}\n`;
    }

    context += "\n";
  }

  if (browser.buttons?.length) {

    context += "Buttons:\n";

    for (
  const button of
  browser.buttons
    .slice(0, MAX_BUTTONS)
) {
      context +=
        `[${button.id}] ${button.text}\n`;
    }

    context += "\n";
  }

  if (browser.links?.length) {

    context += "Links:\n";

    for (
  const link of
  browser.links
    .slice(0, MAX_LINKS)
) {
      context +=
        `[${link.id}] ${link.text}\n`;
    }

    context += "\n";
  }

  return context;
}
export function buildRelevantBrowserContext(
  goal = ""
) {

  const browser =
    getBrowserState();

  if (!browser) {
    return "";
  }

  let context = "";

  if (browser.url) {
    context += `URL:\n${browser.url}\n\n`;
  }

  if (browser.title) {
    context += `Title:\n${browser.title}\n\n`;
  }

  if (browser.inputs?.length) {

    context += "Inputs:\n";

    for (const input of browser.inputs) {
      context +=
        `[${input.id}] ${input.text}\n`;
    }

    context += "\n";
  }

  if (browser.buttons?.length) {

    context += "Buttons:\n";

    for (const button of browser.buttons) {
      context +=
        `[${button.id}] ${button.text}\n`;
    }

    context += "\n";
  }

  if (browser.links?.length) {

    context += "Links:\n";

    for (const link of browser.links) {
      context +=
        `[${link.id}] ${link.text}\n`;
    }

    context += "\n";
  }

  return context;
}