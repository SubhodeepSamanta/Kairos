import {
  getBrowserState
} from "./state.js";

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