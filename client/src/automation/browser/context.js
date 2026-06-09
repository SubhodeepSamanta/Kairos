let browserContext = {
  title: "",
  url: "",
  text: "",
  buttons: [],
  inputs: [],
  links: []
};

export function updateBrowserContext(data) {
  browserContext = {
    ...browserContext,
    ...data
  };
}

export function getBrowserContext() {
  return browserContext;
}