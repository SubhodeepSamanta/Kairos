import { getPage, listTabs } from "../../browser.js";
import { updateBrowserContext } from "../../context.js";
import { clearRegistry, registerElement } from "../../elements/registry.js";
import { classifyPage } from "../classifier/index.js";
import { extractPageText } from "./pageReader.js";
import { readAriaElements } from "./ariaReader.js";
import { readButtons } from "./buttonReader.js";
import { readInputs } from "./inputReader.js";
import { readLinks } from "./linkReader.js";
import { readForms } from "./formReader.js";
import { scoreObservation } from "./qualityScorer.js";

const DOM_ONLY_OFFSET = 100000;

const ARIA_ROLE_TYPE_MAP = {
  searchbox: "search_input",
  textbox: "input_element",
  combobox: "search_input",
  button: "action_target",
  link: "navigation_element",
  tab: "navigation_element",
  menuitem: "navigation_element",
  checkbox: "selection_candidate",
  radio: "selection_candidate",
  option: "selection_candidate"
};

const ARIA_ROLE_PURPOSE_MAP = {
  searchbox: "search_input",
  textbox: "input_element",
  combobox: "search_input",
  button: "action_target",
  link: "navigation_target"
};

const ARIA_ROLE_ACTION_MAP = {
  button: ["click"],
  link: ["click", "navigate"],
  searchbox: ["type", "search"],
  textbox: ["type"],
  combobox: ["type", "search"],
  checkbox: ["click"],
  radio: ["click"],
  switch: ["click"],
  tab: ["click"],
  menuitem: ["click"],
  option: ["click"],
  listbox: ["click"],
  spinbutton: ["type"],
  slider: ["click"],
  treeitem: ["click"]
};

function makeDomLocator(page, el, tag) {
  const text = el.text || el.ariaLabel || el.placeholder || el.name || "";
  if (!text) return page.locator(tag).first();
  const escaped = text.replace(/"/g, '\\"');
  if (tag === "button" || el.role === "button" || el.ariaRole === "button") {
    return page.locator(`button:has-text("${escaped}"), [role="button"]:has-text("${escaped}")`).first();
  }
  if (tag === "link" || el.role === "link" || el.ariaRole === "link") {
    return page.locator(`a:has-text("${escaped}"), [role="link"]:has-text("${escaped}")`).first();
  }
  if (tag === "input" || el.type) {
    return page.locator(`input[placeholder="${escaped}"], input[aria-label="${escaped}"], input[name="${escaped}"]`).first();
  }
  return page.locator(`:has-text("${escaped}")`).first();
}

function findDomMatch(ae, domButtons, domInputs, domLinks) {
  const source = ae.role === "link" ? domLinks
    : ae.role === "button" ? domButtons
    : domInputs;
  return source.find(d => {
    if (!d.text) return false;
    const aName = ae.name.toLowerCase();
    const dText = d.text.toLowerCase();
    return aName === dText || aName.includes(dText) || dText.includes(aName);
  });
}

export async function readPage() {
  const page = await getPage();
  if (!page) return { success: false, reason: "No page available", buttons: [], inputs: [], links: [], forms: [], text: "", tabs: [], observationQuality: null };
  const title = await page.title().catch(() => "unknown");
  const url = page.url();

  clearRegistry();

  const ariaElements = await readAriaElements(page);
  const domButtons = await readButtons(page);
  const domInputs = await readInputs(page);
  const domLinks = await readLinks(page);
  const forms = await readForms(page);
  const text = await extractPageText(page);

  const ariaIndex = new Map();
  for (const ae of ariaElements) {
    ariaIndex.set(`${ae.role}:${ae.name.toLowerCase()}`, ae);
  }

  function isCoveredByAria(role, name) {
    if (!name) return false;
    const roleMap = { button: "button", link: "link", input: "searchbox" };
    const ariaRole = roleMap[role] || role;
    const key = `${ariaRole}:${name.toLowerCase()}`;
    if (ariaIndex.has(key)) return true;
    for (const [k, v] of ariaIndex) {
      if (!k.startsWith(`${ariaRole}:`)) continue;
      if (name.toLowerCase().includes(v.name.toLowerCase())) return true;
      if (v.name.toLowerCase().includes(name.toLowerCase())) return true;
    }
    return false;
  }

  let nextId = 1;
  const allElements = [];

  for (const ae of ariaElements) {
    const id = nextId++;
    registerElement(id, ae.locator, ae.name, ae.role, ae.visualInfo);

    const domMatch = findDomMatch(ae, domButtons, domInputs, domLinks);

    const defaultType = ARIA_ROLE_TYPE_MAP[ae.role] || null;
    const defaultPurpose = ARIA_ROLE_PURPOSE_MAP[ae.role] || null;
    const semanticType = (domMatch?.semanticType && domMatch.semanticType !== "interactive_control")
      ? domMatch.semanticType : defaultType;
    const purpose = (domMatch?.purpose && domMatch.purpose !== "generic")
      ? domMatch.purpose : defaultPurpose;
    const confidence = domMatch?.confidence || 0.95;

    allElements.push({
      id, text: ae.name, role: ae.role, ariaRole: ae.role,
      value: ae.value || "", visible: true, enabled: ae.enabled,
      disabled: !ae.enabled,
      href: ae.role === "link" && domMatch?.href ? domMatch.href : null,
      semanticType, purpose,
      actionHints: ARIA_ROLE_ACTION_MAP[ae.role] || ["click"],
      confidence, ...ae.visualInfo
    });
  }

  let domOnlyId = DOM_ONLY_OFFSET;

  for (const btn of domButtons) {
    if (isCoveredByAria("button", btn.text)) continue;
    const id = domOnlyId++;
    const locator = makeDomLocator(page, btn, "button");
    registerElement(id, locator, btn.text, "button", { inViewport: btn.inViewport, top: btn.top, left: btn.left, width: btn.width, height: btn.height });
    allElements.push({
      id, ...btn, ariaRole: "button",
      semanticType: btn.semanticType || "action_target",
      purpose: btn.purpose || "action_target",
      actionHints: ["click"], confidence: btn.confidence || 0.7
    });
  }

  for (const inp of domInputs) {
    if (isCoveredByAria("input", inp.text)) continue;
    const id = domOnlyId++;
    const locator = makeDomLocator(page, inp, "input");
    registerElement(id, locator, inp.text, "input", { inViewport: inp.inViewport, top: inp.top, left: inp.left, width: inp.width, height: inp.height });
    const ariaRole = inp.type === "search" ? "searchbox" : "textbox";
    allElements.push({
      id, ...inp, ariaRole,
      semanticType: inp.semanticType || (inp.type === "search" ? "search_input" : "input_element"),
      purpose: inp.purpose || (inp.type === "search" ? "search_input" : "input_element"),
      actionHints: ["type"], confidence: inp.confidence || 0.7
    });
  }

  for (const link of domLinks) {
    if (isCoveredByAria("link", link.text)) continue;
    const id = domOnlyId++;
    const locator = makeDomLocator(page, link, "link");
    registerElement(id, locator, link.text, "link", { inViewport: link.inViewport, top: link.top, left: link.left, width: link.width, height: link.height });
    allElements.push({
      id, ...link, ariaRole: "link",
      semanticType: link.semanticType || "navigation_element",
      purpose: link.purpose || "navigation_target",
      actionHints: ["click", "navigate"], confidence: link.confidence || 0.7
    });
  }

  // Tertiary: vision OCR fallback for zero-accessibility pages
  if (ariaElements.length < 3 && allElements.length < 5) {
    try {
      const { visionReadPage } = await import("./visionReader.js");
      const visionElements = await visionReadPage(page);
      for (const ve of visionElements) {
        registerElement(ve.id, null, ve.text, "vision", {
          inViewport: true, top: ve.top, left: ve.left, width: ve.width, height: ve.height
        });
        allElements.push(ve);
      }
      if (visionElements.length > 0) {
        console.log(`[VISION READER] OCR found ${visionElements.length} text elements as fallback`);
      }
    } catch (visionErr) {
      console.log(`[VISION READER] OCR unavailable: ${visionErr.message}`);
    }
  }

  const buttons = allElements.filter(e => e.ariaRole === "button" || e.role === "button");
  const inputs = allElements.filter(e => ["searchbox", "textbox", "combobox", "input"].includes(e.ariaRole));
  const links = allElements.filter(e => e.ariaRole === "link" || e.role === "link");

  const sortByPosition = (a, b) => (a.top ?? Infinity) - (b.top ?? Infinity);
  const cappedButtons = buttons.sort(sortByPosition).slice(0, 50);
  const cappedInputs = inputs.sort(sortByPosition).slice(0, 20);
  const cappedLinks = links.sort(sortByPosition).slice(0, 200);

  console.log(`[ARIA READER] ${ariaElements.length} ARIA interactive, ${allElements.length} total (${domOnlyId - DOM_ONLY_OFFSET} DOM-only, ${allElements.filter(e => e.ariaRole === "vision_text").length} vision)`);

  const tabs = await listTabs().catch(() => []);
  const activeTab = tabs.find(t => t.active) || null;
  const classification = classifyPage(url, title, { inputs, buttons, links });
  const pageType = classification.pageType;
  const site = classification.site;
  const environment = classification.environment || "generic";
  const genericPageType = classification.pageType;

  updateBrowserContext({
    title, url, pageType, site, environment, genericPageType,
    buttons: cappedButtons,
    inputs: cappedInputs,
    links: cappedLinks,
    forms, text, tabs, activeTab
  });

  const quality = scoreObservation(text, cappedButtons, cappedInputs, cappedLinks);

  return {
    success: true,
    title, url, pageType, site, environment, genericPageType,
    buttons: cappedButtons,
    inputs: cappedInputs,
    links: cappedLinks,
    forms, text, tabs, activeTab,
    observationQuality: quality
  };
}
