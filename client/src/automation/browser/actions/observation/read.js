import { getPage, listTabs } from "../../browser.js";
import { clearRegistry, registerElement } from "../../elements/registry.js";
import { extractPageText } from "./pageReader.js";
import { readAriaElements } from "./ariaReader.js";
import { readButtons } from "./buttonReader.js";
import { readInputs } from "./inputReader.js";
import { readLinks } from "./linkReader.js";
import { readSelects } from "./selectReader.js";

const DOM_ONLY_OFFSET = 100000;

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

function slim(el) {
  return {
    id: el.id,
    ariaRole: el.ariaRole,
    text: el.text || "",
    value: el.value || "",
    href: el.href || null,
    disabled: Boolean(el.disabled),
    placeholder: el.placeholder || "",
    type: el.type || "",
    options: el.options || undefined,
    totalOptions: el.totalOptions || undefined
  };
}

export async function readPage() {
  const page = await getPage();
  if (!page) return { success: false, reason: "No page available", buttons: [], inputs: [], links: [], text: "", tabs: [] };
  const title = await page.title().catch(() => "unknown");
  const url = page.url();

  clearRegistry();

  const ariaElements = await readAriaElements(page);
  const domButtons = await readButtons(page);
  const domInputs = await readInputs(page);
  const domLinks = await readLinks(page);
  const domSelects = await readSelects(page);
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

  const selectByName = new Map();
  for (const sel of domSelects) selectByName.set(sel.text.toLowerCase(), sel);

  let nextId = 1;
  const allElements = [];

  for (const ae of ariaElements) {
    const id = nextId++;
    const matchedSelect = ae.role === "combobox" ? selectByName.get(ae.name.toLowerCase()) : null;
    if (matchedSelect) {
      registerElement(id, matchedSelect.locator, ae.name, "select", ae.visualInfo);
      selectByName.delete(ae.name.toLowerCase());
    } else {
      registerElement(id, ae.locator, ae.name, ae.role, ae.visualInfo);
    }
    allElements.push({
      id,
      ariaRole: ae.role,
      text: ae.name,
      value: matchedSelect?.value || ae.value || "",
      options: matchedSelect?.options,
      totalOptions: matchedSelect?.totalOptions,
      disabled: !ae.enabled,
      top: ae.visualInfo?.top ?? null
    });
  }

  let domOnlyId = DOM_ONLY_OFFSET;

  for (const btn of domButtons) {
    if (isCoveredByAria("button", btn.text)) continue;
    const id = domOnlyId++;
    registerElement(id, makeDomLocator(page, btn, "button"), btn.text, "button", { top: btn.top, left: btn.left });
    allElements.push({ ...btn, id, ariaRole: "button" });
  }

  for (const inp of domInputs) {
    if (isCoveredByAria("input", inp.text)) continue;
    const id = domOnlyId++;
    registerElement(id, makeDomLocator(page, inp, "input"), inp.text, "input", { top: inp.top, left: inp.left });
    allElements.push({ ...inp, id, ariaRole: inp.type === "search" ? "searchbox" : "textbox" });
  }

  for (const link of domLinks) {
    if (isCoveredByAria("link", link.text)) continue;
    const id = domOnlyId++;
    registerElement(id, makeDomLocator(page, link, "link"), link.text, "link", { top: link.top, left: link.left });
    allElements.push({ ...link, id, ariaRole: "link" });
  }

  for (const sel of selectByName.values()) {
    const id = domOnlyId++;
    registerElement(id, sel.locator, sel.text, "select", { top: sel.top, left: sel.left });
    allElements.push({
      id,
      ariaRole: "combobox",
      text: sel.text,
      value: sel.value,
      options: sel.options,
      totalOptions: sel.totalOptions,
      disabled: false,
      top: sel.top
    });
  }

  if (ariaElements.length < 3 && allElements.length < 5) {
    try {
      const { visionReadPage } = await import("./visionReader.js");
      const visionElements = await visionReadPage(page);
      for (const ve of visionElements) {
        registerElement(ve.id, null, ve.text, "vision", { top: ve.top, left: ve.left, width: ve.width, height: ve.height });
        allElements.push({ ...ve, ariaRole: "vision_text" });
      }
      if (visionElements.length > 0) {
        console.log(`[VISION] OCR fallback found ${visionElements.length} text elements`);
      }
    } catch (visionErr) {
      console.log(`[VISION] OCR unavailable: ${visionErr.message}`);
    }
  }

  const byPosition = (a, b) => (a.top ?? Infinity) - (b.top ?? Infinity);
  const inputRoles = ["searchbox", "textbox", "combobox", "input", "spinbutton"];
  const inputs = allElements.filter(e => inputRoles.includes(e.ariaRole)).sort(byPosition).map(slim);
  const links = allElements.filter(e => e.ariaRole === "link").sort(byPosition).map(slim);
  const buttons = allElements
    .filter(e => !inputRoles.includes(e.ariaRole) && e.ariaRole !== "link")
    .sort(byPosition)
    .map(slim);

  console.log(`[READ] ${ariaElements.length} ARIA, ${allElements.length} total elements`);

  const tabs = await listTabs().catch(() => []);
  const activeTab = tabs.find(t => t.active) || null;

  return {
    success: true,
    title,
    url,
    buttons,
    inputs,
    links,
    text,
    tabs,
    activeTab
  };
}
