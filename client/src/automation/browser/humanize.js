const HUMAN = process.env.HUMANIZE !== "false";

export function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

export async function pause(min, max) {
  if (!HUMAN) return;
  await new Promise(r => setTimeout(r, rand(min, max)));
}

export async function thinkBeforeAction() {
  await pause(120, 420);
}

export async function moveToElement(page, locator) {
  if (!HUMAN) return;
  try {
    const box = await locator.boundingBox();
    if (!box) return;
    const targetX = box.x + box.width * (0.35 + Math.random() * 0.3);
    const targetY = box.y + box.height * (0.35 + Math.random() * 0.3);
    const steps = rand(4, 9);
    await page.mouse.move(targetX, targetY, { steps });
    await pause(40, 140);
  } catch {}
}

export async function humanType(page, locator, text) {
  const delay = HUMAN ? rand(35, 85) : 0;
  if (locator) {
    await locator.pressSequentially(text, { delay });
  } else {
    await page.keyboard.type(text, { delay });
  }
}

export async function humanScroll(page, direction, amount = 600) {
  const distance = direction === "up" ? -amount : amount;
  if (!HUMAN) {
    await page.mouse.wheel(0, distance);
    return;
  }
  const chunks = rand(3, 6);
  const per = Math.round(distance / chunks);
  for (let i = 0; i < chunks; i++) {
    await page.mouse.wheel(0, per + rand(-25, 25));
    await pause(60, 160);
  }
}

export const HUMANIZE_ENABLED = HUMAN;
