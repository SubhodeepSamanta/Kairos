const idToLocator = new Map();

export function clearRegistry() {
  idToLocator.clear();
}

/**
 * Stores the active Playwright locator and metadata for a given stable ID.
 */
export function registerElement(id, locator, text = null, role = null) {
  const intId = parseInt(id, 10);
  idToLocator.set(intId, { locator, text, role });
  return intId;
}

export function getElement(id) {
  const entry = idToLocator.get(parseInt(id, 10));
  return entry ? entry.locator : null;
}

export function getElementInfo(id) {
  return idToLocator.get(parseInt(id, 10));
}

export function hasElement(id) {
  return idToLocator.has(parseInt(id, 10));
}

export function pruneRegistry() {
  // Pruning of stale DOM references is handled naturally via clearRegistry on each page read
}