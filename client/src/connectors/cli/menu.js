const C = {
  dim: "\x1b[90m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
  yellow: "\x1b[33m",
  invert: "\x1b[7m"
};

export function renderMenu(out, items, selected) {
  if (!items.length) return 0;

  const width = Math.max(...items.map(i => i.label.length));
  out.write("\n");
  items.forEach((item, i) => {
    const active = i === selected;
    const marker = active ? `${C.cyan}▸${C.reset}` : " ";
    const label = active ? `${C.bold}${C.cyan}${item.label.padEnd(width)}${C.reset}` : `${item.label.padEnd(width)}`;
    out.write(`${marker} ${label}  ${C.dim}${item.help || ""}${C.reset}\n`);
  });
  out.write(`${C.dim}↑↓ choose · tab complete · enter send · esc close${C.reset}\n`);
  return items.length + 2;
}

export function clearMenu(out, lines) {
  if (!lines) return;
  out.write(`\x1b[${lines}A`);
  for (let i = 0; i < lines; i++) out.write("\x1b[2K\x1b[1B");
  out.write(`\x1b[${lines}A`);
}

export const colors = C;
