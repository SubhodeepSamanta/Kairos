const MAX_LABEL_CHARS = 45;
const MAX_LINKS = 30;
const MAX_TEXT_CHARS = 500;
const MAX_TEXT_CHARS_AFTER_READ = 1500;
const NAV_NOISE = /^(home|skip to|sign in|sign up|log in|about|privacy|terms|help|settings|cookie|accessibility|advertise|press|copyright|contact us|careers)$/i;

function cleanLabel(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LABEL_CHARS);
}

function formatInput(el) {
  const parts = [`[${el.id}]`];
  const role = el.options ? "select" : el.ariaRole || el.type || "input";
  parts.push(role);
  const label = cleanLabel(el.text || el.placeholder || el.name || el.ariaLabel);
  if (label) parts.push(`"${label}"`);
  if (el.value) parts.push(`value="${cleanLabel(el.value)}"`);
  if (el.options?.length) {
    const more = el.totalOptions > el.options.length ? `, +${el.totalOptions - el.options.length} more` : "";
    parts.push(`options: ${el.options.map(o => cleanLabel(o)).join(" | ")}${more}`);
  }
  if (el.disabled) parts.push("(disabled)");
  return parts.join(" ");
}

function formatButton(el) {
  const parts = [`[${el.id}]`];
  const label = cleanLabel(el.text || el.ariaLabel);
  parts.push(label ? `"${label}"` : "(no label)");
  if (el.disabled) parts.push("(disabled)");
  return parts.join(" ");
}

function formatLink(el) {
  const label = cleanLabel(el.text);
  return `[${el.id}] "${label || el.href || "(no label)"}"`;
}

function dedupe(elements, keyFn) {
  const seen = new Set();
  const out = [];
  for (const el of elements) {
    const key = keyFn(el);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(el);
  }
  return out;
}

const BLANK_URL = /^(about:blank|about:newtab|chrome:\/\/new-?tab|chrome:\/\/newtab|edge:\/\/newtab|brave:\/\/newtab)/i;

export function isBlankPage(page) {
  if (!page || !page.url) return true;
  if (!BLANK_URL.test(page.url)) return false;
  const hasStuff = (page.inputs?.length || 0) + (page.buttons?.length || 0) + (page.links?.length || 0);
  return hasStuff === 0;
}

export function formatSnapshot(page, { fullText = false } = {}) {
  if (!page || (!page.url && !page.title)) {
    return "BROWSER: no page loaded yet (use navigate to open one)";
  }

  if (isBlankPage(page)) {
    return `BROWSER: empty tab (${page.url}). Nothing is loaded and nothing will load on its own — waiting, reading or scrolling here does nothing. Use navigate to go somewhere.`;
  }

  const lines = [];
  lines.push(`URL: ${page.url || "unknown"}`);
  lines.push(`TITLE: ${cleanLabel(page.title) || "unknown"}`);
  if (page.via) lines.push(`VIA: ${page.via}`);

  const tabs = page.tabs || [];
  if (tabs.length > 1 || (tabs.length === 1 && tabs[0].index !== 0)) {
    const tabLine = tabs
      .map(t => `[${t.index}${t.active ? "*" : ""}] ${cleanLabel(t.title || t.url).slice(0, 40)}`)
      .join(" | ");
    lines.push(`TABS: ${tabLine}`);
  }

  const inputs = page.inputs || [];
  const buttons = dedupe(page.buttons || [], b => cleanLabel(b.text));
  let links = dedupe(page.links || [], l => `${cleanLabel(l.text)}|${l.href || ""}`);

  if (inputs.length) {
    lines.push(`INPUTS (${inputs.length}):`);
    for (const el of inputs) lines.push(formatInput(el));
  }
  if (buttons.length) {
    lines.push(`BUTTONS (${buttons.length}):`);
    for (const el of buttons) lines.push(formatButton(el));
  }
  if (links.length) {
    const total = links.length;
    if (links.length > MAX_LINKS) {
      const meaningful = links.filter(l => !NAV_NOISE.test(cleanLabel(l.text)));
      links = (meaningful.length >= MAX_LINKS ? meaningful : links).slice(0, MAX_LINKS);
    }
    lines.push(`LINKS (${total}${total > links.length ? `, showing ${links.length} most relevant — scroll then read for more` : ""}):`);
    for (const el of links) lines.push(formatLink(el));
  }
  if (!inputs.length && !buttons.length && !links.length) {
    lines.push(
      String(page.text || "").trim()
        ? "ELEMENTS: none interactive — this page is text only. If what you need isn't in the text below, go elsewhere."
        : "ELEMENTS: none, and no text. Page may still be loading (wait then read once) or it blocked us — if a second read is still empty, try a different url."
    );
  }

  const text = String(page.text || "").replace(/\s+/g, " ").trim();
  if (text) {
    const cap = fullText ? MAX_TEXT_CHARS_AFTER_READ : MAX_TEXT_CHARS;
    lines.push(`PAGE TEXT: ${text.slice(0, cap)}${text.length > cap ? " …(use read for more)" : ""}`);
  }

  return lines.join("\n");
}

export function describePageChange(before, after) {
  if (!after) return "no observation";
  if (isBlankPage(after)) return `now on an empty tab (${after.url || "about:blank"}) — navigate to load something`;
  const where = `${after.url || "unknown"}${after.title ? ` "${cleanLabel(after.title)}"` : ""}`;
  if (!before) return `now on ${where}`;
  if (before.url !== after.url) return `now on ${where}`;
  if (before.title !== after.title) return `still on ${after.url}, title now "${cleanLabel(after.title)}"`;
  return `still on ${where}`;
}
