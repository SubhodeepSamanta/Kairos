let browserContext = {
  title: "",
  url: "",
  content: ""
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