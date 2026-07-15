import { createWorker } from "tesseract.js";
import path from "path";
import fs from "fs";

let worker = null;

async function getWorker() {
  if (!worker) {
    worker = await createWorker("eng");
  }
  return worker;
}

export async function visionReadPage(page) {
  const viewport = page.viewportSize() || { width: 1280, height: 720 };
  const screenshotPath = path.join(process.cwd(), "screenshots", `vision-${Date.now()}.png`);
  const dir = path.dirname(screenshotPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await page.screenshot({ path: screenshotPath, fullPage: false });

  const w = await getWorker();
  const { data } = await w.recognize(screenshotPath);

  const elements = [];
  const seen = new Set();

  for (const word of data.words || []) {
    const text = word.text.trim();
    if (!text || text.length < 2 || seen.has(text.toLowerCase())) continue;
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