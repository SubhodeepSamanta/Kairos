import { createWorker } from "tesseract.js";
import path from "path";
import fs from "fs";

const MIN_WORD_CONFIDENCE = 40;

let worker = null;

export function wordsFrom(data) {
  if (data?.words?.length) return data.words;
  const out = [];
  for (const block of data?.blocks || []) {
    for (const paragraph of block?.paragraphs || []) {
      for (const line of paragraph?.lines || []) {
        for (const word of line?.words || []) out.push(word);
      }
    }
  }
  return out;
}

async function getWorker() {
  if (!worker) {
    worker = await createWorker("eng");
  }
  return worker;
}

export async function readTextFromImage(imagePath) {
  const w = await getWorker();
  const { data } = await w.recognize(imagePath, {}, { blocks: true });
  const lines = [];
  for (const block of data?.blocks || []) {
    for (const paragraph of block?.paragraphs || []) {
      for (const line of paragraph?.lines || []) {
        const text = String(line?.text || "").replace(/\s+/g, " ").trim();
        if (text) lines.push(text);
      }
    }
  }
  if (lines.length) return lines.join("\n");
  return String(data?.text || "").trim();
}

export async function visionReadPage(page) {
  const viewport = page.viewportSize() || { width: 1280, height: 720 };
  const screenshotPath = path.join(process.cwd(), "screenshots", `vision-${Date.now()}.png`);
  const dir = path.dirname(screenshotPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await page.screenshot({ path: screenshotPath, fullPage: false });

  const w = await getWorker();
  const { data } = await w.recognize(screenshotPath, {}, { blocks: true });

  const elements = [];
  const seen = new Set();

  for (const word of wordsFrom(data)) {
    const text = word.text.trim();
    if (!text || text.length < 2 || seen.has(text.toLowerCase())) continue;
    if ((word.confidence ?? 0) < MIN_WORD_CONFIDENCE) continue;
    seen.add(text.toLowerCase());

    const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
    const centerY = (word.bbox.y0 + word.bbox.y1) / 2;
    const width = word.bbox.x1 - word.bbox.x0;
    const height = word.bbox.y1 - word.bbox.y0;

    elements.push({
      id: -(Date.now() + elements.length + Math.floor(Math.random() * 1000)),
      text,
      role: "vision_text",
      ariaRole: "vision_text",
      visible: true,
      enabled: true,
      semanticType: "text_content",
      purpose: "text_content",
      actionHints: ["click"],
      confidence: Math.min(word.confidence / 100, 0.85),
      inViewport: true,
      top: Math.round(centerY - height / 2),
      left: Math.round(centerX - width / 2),
      width: Math.round(width),
      height: Math.round(height),
      centerX: Math.round(centerX),
      centerY: Math.round(centerY)
    });
  }

  try { fs.unlinkSync(screenshotPath); } catch {}

  return elements;
}

export async function visionLocateText(page, text, elements) {
  const candidates = elements.filter(e =>
    e.ariaRole === "vision_text" && e.text.toLowerCase() === text.toLowerCase()
  );
  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => a.confidence > b.confidence ? a : b);
    return best;
  }
  return null;
}

export async function destroyVisionWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}