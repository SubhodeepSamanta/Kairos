import { getPage, listTabs } from "../browser.js";
import { updateBrowserContext } from "../context.js";
import {
  clearRegistry,
  registerElement,
  pruneRegistry
} from "../elements/registry.js";

export async function readPage() {
  const page = await getPage();
  const title = await page.title().catch(() => "unknown");
  const url = page.url();
  
  // Clear locator references for the current read
  clearRegistry();

  // 1. Inject data-kairos-id attributes directly to interactive elements in DOM
  await page.evaluate(() => {
    window.__kairosNextId = window.__kairosNextId || 1;
    const selectors = [
      "button:not([disabled])",
      "input:not([type='hidden']):not([disabled])",
      "textarea:not([disabled])",
      "a",
      "form"
    ];
    const elements = document.querySelectorAll(selectors.join(", "));
    elements.forEach(el => {
      if (!el.getAttribute("data-kairos-id")) {
        el.setAttribute("data-kairos-id", String(window.__kairosNextId++));
      }
    });
  }).catch(() => {});

  // 2. Buttons
  const buttons = [];
  const buttonLocators = page.locator("button:not([disabled])");
  const buttonCount = await buttonLocators.count().catch(() => 0);

  for (let i = 0; i < buttonCount; i++) {
    const locator = buttonLocators.nth(i);
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    const id = await locator.getAttribute("data-kairos-id").catch(() => null);
    if (!id) continue;

    const text = await locator.innerText().catch(() => "");
    if (!text.trim()) continue;

    registerElement(id, page.locator(`[data-kairos-id="${id}"]`));

    const enabled = await locator.isEnabled().catch(() => true);
    buttons.push({
      id: parseInt(id, 10),
      text,
      role: "button",
      visible: true,
      enabled
    });
  }

  // 3. Inputs
  const inputs = [];
  const inputLocators = page.locator("input:not([type='hidden']):not([disabled]), textarea:not([disabled])");
  const inputCount = await inputLocators.count().catch(() => 0);

  for (let i = 0; i < inputCount; i++) {
    const locator = inputLocators.nth(i);
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    const id = await locator.getAttribute("data-kairos-id").catch(() => null);
    if (!id) continue;

    const metadata = await locator.evaluate(el => ({
      placeholder: el.placeholder || null,
      name: el.name || null,
      type: el.type || null,
      value: el.value || null
    })).catch(() => ({}));

    registerElement(id, page.locator(`[data-kairos-id="${id}"]`));

    const enabled = await locator.isEnabled().catch(() => true);
    inputs.push({
      id: parseInt(id, 10),
      text: metadata.placeholder || metadata.name || metadata.type || "input",
      value: metadata.value || "",
      role: "input",
      placeholder: metadata.placeholder,
      visible: true,
      enabled
    });
  }

  // 4. Links
  const links = [];
  const linkLocators = page.locator("a");
  const linkCount = await linkLocators.count().catch(() => 0);

  for (let i = 0; i < linkCount; i++) {
    const locator = linkLocators.nth(i);
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    const id = await locator.getAttribute("data-kairos-id").catch(() => null);
    if (!id) continue;

    const text = await locator.innerText().catch(() => "");
    if (!text.trim()) continue;

    registerElement(id, page.locator(`[data-kairos-id="${id}"]`));

    const enabled = await locator.isEnabled().catch(() => true);
    links.push({
      id: parseInt(id, 10),
      text,
      role: "link",
      visible: true,
      enabled
    });
  }

  // 5. Forms
  const forms = [];
  const formLocators = page.locator("form");
  const formCount = await formLocators.count().catch(() => 0);

  for (let i = 0; i < formCount; i++) {
    const locator = formLocators.nth(i);
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    const id = await locator.getAttribute("data-kairos-id").catch(() => null);
    if (!id) continue;

    const metadata = await locator.evaluate(el => ({
      id: el.id || null,
      action: el.action || null,
      method: el.method || null,
      role: el.getAttribute("role") || "form"
    })).catch(() => ({}));

    registerElement(id, page.locator(`[data-kairos-id="${id}"]`));

    forms.push({
      id: parseInt(id, 10),
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
  }).catch(() => "");

  const cappedButtons = buttons.slice(0, 20);
  const cappedInputs = inputs.slice(0, 10);
  const cappedLinks = links.slice(0, 20);

  // Get active tabs
  const tabs = await listTabs().catch(() => []);
  const activeTab = tabs.find(t => t.active) || null;

  updateBrowserContext({
    title,
    url,
    buttons: cappedButtons,
    inputs: cappedInputs,
    links: cappedLinks,
    forms,
    text,
    tabs,
    activeTab
  });
  
  const scoreReasons = [];
  let score = 1.0;

  if (text.length < 100) {
    score -= 0.5;
    scoreReasons.push("Low text content");
  }
  
  const textLower = text.toLowerCase();
  if (textLower.includes("loading...") || textLower.includes("please wait") || textLower.includes("fetching")) {
    score -= 0.3;
    scoreReasons.push("Loading text detected");
  }

  if (cappedButtons.length === 0 && cappedInputs.length === 0 && cappedLinks.length === 0) {
    score -= 0.4;
    scoreReasons.push("No interactive elements");
  }

  score = Math.max(0.0, score);

  return {
    success: true,
    title,
    url,
    buttons: cappedButtons,
    inputs: cappedInputs,
    links: cappedLinks,
    forms,
    text,
    tabs,
    activeTab,
    observationQuality: {
      score,
      reasons: scoreReasons
    }
  };
}