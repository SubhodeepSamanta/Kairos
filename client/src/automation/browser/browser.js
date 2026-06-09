import { chromium } from "playwright";

let browser = null;
let page = null;

export async function launchBrowser() {

  if (
    browser &&
    browser.isConnected() &&
    page &&
    !page.isClosed()
  ) {
    return page;
  }

  browser = await chromium.launch({
    headless: false
  });

  page = await browser.newPage();

  return page;
}

export async function getPage() {

  if (
    !browser ||
    !browser.isConnected() ||
    !page ||
    page.isClosed()
  ) {
    return launchBrowser();
  }

  return page;
}

export async function closeBrowser() {

  if (browser) {
    await browser.close();
  }

  browser = null;
  page = null;
}