const MAX_LABEL_CHARS = 45;
const MAX_LINKS = 35;
const MAX_TEXT_CHARS = 500;
const NAV_NOISE = /^(home|skip to|sign in|sign up|log in|about|privacy|terms|help|settings|cookie|accessibility|advertise|press|copyright|contact us|careers)$/i;

function cleanLabel(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LABEL_CHARS);
}

function formatInput(el) {
  const parts = [`[${el.id}]`];
  const role = el.ariaRole || el.type || "input";
  parts.push(role);
  const label = cleanLabel(el.text || el.placeholder || el.name || el.ariaLabel);
  if (label) parts.push(`"${label}"`);
  if (el.value) parts.push(`value="${cleanLabel(el.value)}"`);
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

export function formatSnapshot(page) {
  if (!page || (!page.url && !page.title)) {
    return "BROWSER: no page loaded yet (use navigate to open one)";
  }

  const lines = [];
  lines.push(`URL: ${page.url || "unknown"}`);
  lines.push(`TITLE: ${cleanLabel(page.title) || "unknown"}`);

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
    lines.push("ELEMENTS: none detected (page may still be loading — try wait then read, or scroll)");
  }

  const text = String(page.text || "").replace(/\s+/g, " ").trim();
  if (text) {
    lines.push(`PAGE TEXT: ${text.slice(0, MAX_TEXT_CHARS)}${text.length > MAX_TEXT_CHARS ? " …" : ""}`);
  }

  return lines.join("\n");
}

export function describePageChange(before, after) {
  if (!after) return "no observation";
  if (!before) return `now on ${after.url || "unknown"}`;
  if (before.url !== after.url) return `page changed to ${after.url}`;
  if (before.title !== after.title) return `title changed to "${cleanLabel(after.title)}"`;
  return "page did not change";
}
