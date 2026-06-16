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

  const page =
    pages[activePageIndex];

  if (
    !page ||
    page.isClosed()
  ) {
    return launchBrowser();
  }

  return page;
}

export async function createTab() {

  const page =
    await getPage();

  const context =
    page.context();

  const newPage =
  await context.newPage();

  pages.push(newPage);

  activePageIndex =
    pages.length - 1;

  return newPage;
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

  pages.splice(index, 1);

  if (
    activePageIndex >=
    pages.length
  ) {
    activePageIndex =
      Math.max(
        0,
        pages.length - 1
      );
  }
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

    tabs.push({
      index: i,
      title:
        await page.title(),
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

  if (
    !browser ||
    !browser.isConnected()
  ) {
    await launchBrowser();
  }

  const newPage =
    await browser.newPage();

  pages.push(newPage);

  activePageIndex =
    pages.length - 1;

  return {
    success: true,
    index: activePageIndex
  };
}