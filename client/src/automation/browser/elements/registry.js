const idToLocator = new Map();

export function clearRegistry() {
  idToLocator.clear();
}

function normalizeKey(id) {
  return typeof id === "number" ? id : parseInt(id, 10);
}

export function registerElement(id, locator, text = null, role = null, box = null, frameId = null) {
  const key = normalizeKey(id);
  idToLocator.set(key, { locator, text, role, box, frameId });
  return key;
}

export function getElementBox(id) {
  const entry = idToLocator.get(normalizeKey(id));
  return entry ? entry.box : null;
}

export function getElement(id) {
  const entry = idToLocator.get(normalizeKey(id));
  return entry ? entry.locator : null;
}

export function getElementInfo(id) {
  return idToLocator.get(normalizeKey(id));
}

export function hasElement(id) {
  return idToLocator.has(normalizeKey(id));
}

export function pruneRegistry() {
}
