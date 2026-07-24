import { bridgeRead } from "./windows/uia.js";
import { resetDesktop, registerDesktopElement } from "./registry.js";
import { formatDesktopSnapshot } from "./snapshot.js";

export async function readDesktop() {
  if (process.platform !== "win32") {
    return { success: false, reason: "desktop control is only available on Windows right now" };
  }
  let window;
  let elements;
  try {
    ({ window, elements } = await bridgeRead());
  } catch (err) {
    return { success: false, reason: `could not read the desktop: ${err.message.slice(0, 120)}` };
  }
  resetDesktop(window);
  for (const el of elements) registerDesktopElement(el.id, el);
  return {
    success: true,
    window,
    count: elements.length,
    text: formatDesktopSnapshot({ window, elements })
  };
}
