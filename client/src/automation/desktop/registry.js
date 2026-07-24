let elements = new Map();
let currentWindow = null;

export function resetDesktop(window = null) {
  elements = new Map();
  currentWindow = window;
}

export function registerDesktopElement(id, element) {
  elements.set(Number(id), element);
  return Number(id);
}

export function getDesktopElement(id) {
  return elements.get(Number(id)) || null;
}

export function hasDesktopElement(id) {
  return elements.has(Number(id));
}

export function desktopWindow() {
  return currentWindow;
}

export function desktopElementCount() {
  return elements.size;
}
