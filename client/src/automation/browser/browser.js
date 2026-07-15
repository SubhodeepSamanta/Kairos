import { chromium } from "playwright";

let browser = null;

let pages = [];
let activePageIndex = 0;
let context = null;

export async function launchBrowser() {

  if (
    browser &&
    browser.isConnected() &&
    pages.length > 0 &&
    !pages[activePageIndex]?.isClosed()
  ) {
    return pages[activePageIndex];
  }

  browser =
  await chromium.launch({
    headless: false
  });

context =
  await browser.newContext();

context.on("page", page => {
  if (!pages.includes(page)) {
    pages.push(page);
  }
  page.on("close", () => {
    const idx = pages.indexOf(page);
    if (idx !== -1) {
      pages.splice(idx, 1);
      if (activePageIndex >= pages.length) {
        activePageIndex = Math.max(0, pages.length - 1);
      }
    }
  });
});

const page =
  await context.newPage();

  pages = [page];
  activePageIndex = 0;

  return page;
}

export async function getPage() {

  if (
    !browser ||
    !browser.isConnected() ||
    pages.length === 0
  ) {
    return launchBrowser();
  }

  let page =
    pages[activePageIndex];

  if (
    !page ||
    page.isClosed()
  ) {
    const openPageIndex = pages.findIndex(p => p && !p.isClosed());
    if (openPageIndex !== -1) {
      activePageIndex = openPageIndex;
      page = pages[activePageIndex];
    } else {
      return launchBrowser();
    }
  }

  return page;
}

export function switchTab(index) {

  if (
    index < 0 ||
    index >= pages.length
  ) {
    throw new Error(
      "tab_not_found"
    );
  }

  activePageIndex = index;

  return pages[index];
}

export async function closeTab(index) {

  if (
    index < 0 ||
    index >= pages.length
  ) {
    throw new Error(
      "tab_not_found"
    );
  }

  await pages[index].close();
}

export async function listTabs() {

  const tabs = [];

  for (
    let i = 0;
    i < pages.length;
    i++
  ) {

    const page =
      pages[i];

    if (!page || page.isClosed()) {
      continue;
    }

    tabs.push({
      index: i,
      title:
        await page.title().catch(() => "unknown"),
      url:
        page.url(),
      active:
        i ===
        activePageIndex
    });
  }

  return tabs;
}

export async function closeBrowser() {

  if (browser) {
    await browser.close();
  }

  browser = null;
  pages = [];
  activePageIndex = 0;
}

export async function restartBrowser() {

  await closeBrowser();

  return launchBrowser();
}

export function getCurrentPage() {

  return pages[
    activePageIndex
  ];
}

export function isBrowserOpen() {

  return (
    browser &&
    browser.isConnected() &&
    pages.length > 0 &&
    !pages[
      activePageIndex
    ]?.isClosed()
  );
}

export async function createNewTab() {
  if (!browser || !browser.isConnected()) {
    await launchBrowser();
  }

  const newPage = await new Promise((resolve) => {
    const handler = (page) => {
      context.removeListener("page", handler);
      resolve(page);
    };
    context.on("page", handler);
    context.newPage().then(page => {
      if (pages.includes(page)) resolve(page);
    });
    setTimeout(() => {
      context.removeListener("page", handler);
      resolve(null);
    }, 5000);
  });

  if (!newPage) {
    return { success: false, reason: "Failed to create new tab within timeout" };
  }

  if (!pages.includes(newPage)) {
    pages.push(newPage);
  }
  activePageIndex = pages.indexOf(newPage);

  return { success: true, index: activePageIndex };
}