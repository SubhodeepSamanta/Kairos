const elements =
  new Map();

let nextId = 1;

export function clearRegistry() {

  elements.clear();

  nextId = 1;
}

export function registerElement(
  locator
) {

  const id =
    nextId++;

  elements.set(
    id,
    locator
  );

  return id;
}

export function getElement(
  id
) {

  return elements.get(id);
}

export function hasElement(
  id
) {

  return elements.has(id);
}