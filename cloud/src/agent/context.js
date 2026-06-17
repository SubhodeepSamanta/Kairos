import {
  getBrowserState
} from "./state.js";

import { rankElements }
from "./ranker.js";

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

  if (browser.pageType) {
    context += `Page Type:\n${browser.pageType}\n\n`;
  }

  if (browser.url) {
    context += `URL:\n${browser.url}\n\n`;
  }

  if (browser.title) {
    context += `Title:\n${browser.title}\n\n`;
  }

  if (browser.inputs?.length) {
    context += "Inputs:\n";
    for (const input of browser.inputs.slice(0, MAX_INPUTS)) {
      const parts = [];
      if (input.purpose && input.purpose !== "generic") parts.push(`purpose: "${input.purpose}"`);
      if (input.type) parts.push(`type: "${input.type}"`);
      if (input.placeholder) parts.push(`placeholder: "${input.placeholder}"`);
      if (input.ariaLabel) parts.push(`ariaLabel: "${input.ariaLabel}"`);
      if (input.name) parts.push(`name: "${input.name}"`);
      if (input.title) parts.push(`title: "${input.title}"`);
      if (input.value) parts.push(`value: "${input.value}"`);
      const meta = parts.length ? ` (${parts.join(", ")})` : "";
      context += `[${input.id}] ${input.text || "input"}${meta}\n`;
    }
    context += "\n";
  }

  if (browser.buttons?.length) {
    context += "Buttons:\n";
    for (const button of browser.buttons.slice(0, MAX_BUTTONS)) {
      const parts = [];
      if (button.purpose && button.purpose !== "generic") parts.push(`purpose: "${button.purpose}"`);
      if (button.type) parts.push(`type: "${button.type}"`);
      if (button.ariaLabel) parts.push(`ariaLabel: "${button.ariaLabel}"`);
      if (button.name) parts.push(`name: "${button.name}"`);
      if (button.title) parts.push(`title: "${button.title}"`);
      const meta = parts.length ? ` (${parts.join(", ")})` : "";
      context += `[${button.id}] ${button.text || "button"}${meta}\n`;
    }
    context += "\n";
  }

  if (browser.links?.length) {
    context += "Links:\n";
    for (const link of browser.links.slice(0, MAX_LINKS)) {
      const parts = [];
      if (link.purpose && link.purpose !== "generic") parts.push(`purpose: "${link.purpose}"`);
      if (link.href) parts.push(`href: "${link.href}"`);
      if (link.ariaLabel) parts.push(`ariaLabel: "${link.ariaLabel}"`);
      if (link.title) parts.push(`title: "${link.title}"`);
      const meta = parts.length ? ` (${parts.join(", ")})` : "";
      context += `[${link.id}] ${link.text || "link"}${meta}\n`;
    }
    context += "\n";
  }

  if (browser.forms?.length) {
    context += "Forms:\n";
    for (const form of browser.forms) {
      context += `[${form.id}] role: ${form.role || "form"}, action: ${form.action || ""}, method: ${form.method || ""}\n`;
    }
    context += "\n";
  }

  return context;
}
export function buildRelevantBrowserContext(
  intent = ""
) {

  const browser =
    getBrowserState();

  if (!browser) {
    return "";
  }

  const ranked =
    rankElements(
      intent,
      browser
    );

  let context = "";

  if (browser.pageType) {
    context += `Page Type:\n${browser.pageType}\n\n`;
  }

  if (browser.url) {
    context +=
      `URL:\n${browser.url}\n\n`;
  }

  if (browser.title) {
    context +=
      `Title:\n${browser.title}\n\n`;
  }

  // Filter & Compress based on pageType
  let filteredRanked = ranked;
  if (browser.pageType && browser.pageType !== "generic") {
    // Keep elements with semantic purpose, plus higher ranked ones
    filteredRanked = ranked.filter(item => 
      (item.purpose && item.purpose !== "generic") || 
      item.score > 10
    );
    // If we filtered out too much, fall back to top ranked elements
    if (filteredRanked.length < 5) {
      filteredRanked = ranked;
    }
  }

  const PROTECTED_PURPOSES = [
    "search_input",
    "search_launcher",
    "search_button",
    "video_link",
    "product_link",
    "login_button",
    "submit_button",
    "login_email",
    "login_password"
  ];

  const sortProtectedFirst = (a, b) => {
    const aProtected = PROTECTED_PURPOSES.includes(a.purpose);
    const bProtected = PROTECTED_PURPOSES.includes(b.purpose);
    if (aProtected && !bProtected) return -1;
    if (!aProtected && bProtected) return 1;
    return 0;
  };

  const inputs =
    filteredRanked
      .filter(
        item =>
          item.category ===
          "input"
      )
      .sort(sortProtectedFirst)
      .slice(0, 10); // Compressed down from 15

  const buttons =
    filteredRanked
      .filter(
        item =>
          item.category ===
          "button"
      )
      .sort(sortProtectedFirst)
      .slice(0, 15); // Compressed down from 20

  const links =
    filteredRanked
      .filter(
        item =>
          item.category ===
          "link"
      )
      .sort(sortProtectedFirst)
      .slice(0, 15); // Compressed down from 20

  if (inputs.length) {
    context += "Inputs:\n";
    for (const input of inputs) {
      const parts = [];
      if (input.purpose && input.purpose !== "generic") parts.push(`purpose: "${input.purpose}"`);
      if (input.type) parts.push(`type: "${input.type}"`);
      if (input.placeholder) parts.push(`placeholder: "${input.placeholder}"`);
      if (input.ariaLabel) parts.push(`ariaLabel: "${input.ariaLabel}"`);
      if (input.name) parts.push(`name: "${input.name}"`);
      if (input.title) parts.push(`title: "${input.title}"`);
      if (input.value) parts.push(`value: "${input.value}"`);
      const meta = parts.length ? ` (${parts.join(", ")})` : "";
      context += `[${input.id}] ${input.text || "input"}${meta}\n`;
    }
    context += "\n";
  }

  if (buttons.length) {
    context += "Buttons:\n";
    for (const button of buttons) {
      const parts = [];
      if (button.purpose && button.purpose !== "generic") parts.push(`purpose: "${button.purpose}"`);
      if (button.type) parts.push(`type: "${button.type}"`);
      if (button.ariaLabel) parts.push(`ariaLabel: "${button.ariaLabel}"`);
      if (button.name) parts.push(`name: "${button.name}"`);
      if (button.title) parts.push(`title: "${button.title}"`);
      const meta = parts.length ? ` (${parts.join(", ")})` : "";
      context += `[${button.id}] ${button.text || "button"}${meta}\n`;
    }
    context += "\n";
  }

  if (links.length) {
    context += "Links:\n";
    for (const link of links) {
      const parts = [];
      if (link.purpose && link.purpose !== "generic") parts.push(`purpose: "${link.purpose}"`);
      if (link.href) parts.push(`href: "${link.href}"`);
      if (link.ariaLabel) parts.push(`ariaLabel: "${link.ariaLabel}"`);
      if (link.title) parts.push(`title: "${link.title}"`);
      const meta = parts.length ? ` (${parts.join(", ")})` : "";
      context += `[${link.id}] ${link.text || "link"}${meta}\n`;
    }
    context += "\n";
  }

  if (browser.forms?.length) {
    context += "Forms:\n";
    for (const form of browser.forms) {
      context += `[${form.id}] role: ${form.role || "form"}, action: ${form.action || ""}, method: ${form.method || ""}\n`;
    }
    context += "\n";
  }

  return context;
}