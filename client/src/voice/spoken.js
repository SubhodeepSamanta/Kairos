const UNITS = [
  [/(-?\d+(?:\.\d+)?)\s*°\s*C\b/gi, "$1 degrees celsius"],
  [/(-?\d+(?:\.\d+)?)\s*°\s*F\b/gi, "$1 degrees fahrenheit"],
  [/(-?\d+(?:\.\d+)?)\s*°/g, "$1 degrees"],
  [/(\d+(?:\.\d+)?)\s*%/g, "$1 percent"],
  [/(\d+(?:\.\d+)?)\s*km\/h\b/gi, "$1 kilometres per hour"],
  [/(\d+(?:\.\d+)?)\s*mph\b/gi, "$1 miles per hour"],
  [/\$\s*(\d+(?:\.\d+)?)/g, "$1 dollars"],
  [/£\s*(\d+(?:\.\d+)?)/g, "$1 pounds"],
  [/€\s*(\d+(?:\.\d+)?)/g, "$1 euros"]
];

const TIDY = [
  [/[‐-―−]/g, "-"],
  [/[‘’‛]/g, "'"],
  [/[“”]/g, '"'],
  [/…/g, "..."],
  [/ /g, " "],
  [/[*_`#>|]/g, " "],
  [/\s*\n\s*[-•*]\s*/g, ". "],
  [/\s*\n+\s*/g, ". "]
];

function spokenUrl(raw) {
  try {
    const url = new URL(raw);
    const host = url.host.replace(/^www\./, "");
    return host.replace(/\.(com|org|net|io|co|dev)$/i, "");
  } catch {
    return "the link";
  }
}

export function toSpokenText(text) {
  let out = String(text || "");
  if (!out.trim()) return "";

  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, "$1");
  out = out.replace(/https?:\/\/\S+/gi, (m) => spokenUrl(m.replace(/[.,;:)]+$/, "")));
  out = out.replace(/\b([\w.-]+)@([\w.-]+\.\w+)\b/g, "$1 at $2");

  for (const [pattern, replacement] of UNITS) out = out.replace(pattern, replacement);
  for (const [pattern, replacement] of TIDY) out = out.replace(pattern, replacement);

  out = out.replace(/\s*&\s*/g, " and ");
  out = out.replace(/([.!?])\s+\1+/g, "$1");
  out = out.replace(/\.\s+\./g, ".");
  out = out.replace(/([:;,])\s*\./g, "$1");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\s+([.,!?;:])/g, "$1");

  return out.trim();
}
