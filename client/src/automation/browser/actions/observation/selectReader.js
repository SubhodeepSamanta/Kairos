const MAX_OPTIONS = 12;

export async function readSelects(page) {
  const raw = await page.evaluate((maxOptions) => {
    const labelFor = (el) => {
      if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label) return label.textContent.trim();
      }
      const wrapping = el.closest("label");
      if (wrapping) return wrapping.textContent.trim();
      return el.name || "select";
    };

    return Array.from(document.querySelectorAll("select:not([disabled])")).map((el, index) => {
      const rect = el.getBoundingClientRect();
      const options = Array.from(el.options)
        .slice(0, maxOptions)
        .map(o => (o.label || o.value || "").trim())
        .filter(Boolean);
      return {
        index,
        text: labelFor(el).replace(/\s+/g, " ").slice(0, 60),
        value: el.selectedOptions[0]?.label || el.value || "",
        options,
        totalOptions: el.options.length,
        visible: rect.width > 0 && rect.height > 0,
        top: Math.round(rect.top),
        left: Math.round(rect.left)
      };
    });
  }, MAX_OPTIONS).catch(() => []);

  return (Array.isArray(raw) ? raw : [])
    .filter(s => s.visible)
    .map(s => ({
      ...s,
      locator: page.locator("select:not([disabled])").nth(s.index)
    }));
}
