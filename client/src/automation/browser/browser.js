import { chromium } from "playwright";
import {
  browserSpec,
  browserExecutable,
  resolveProfile,
  isBrowserInstalled,
  listProfiles,
  automationDataDir
} from "./profiles.js";

const DEFAULT_BROWSER = process.env.DEFAULT_BROWSER || "chrome";

let browser = null;
let context = null;
let pages = [];
let activePageIndex = 0;
let preferred = { browser: DEFAULT_BROWSER, profile: null };
let current = { browser: "playwright", profile: null, profileLabel: null, mode: "playwright" };

const VIEWPORT = { width: 1440, height: 900 };
const BLANK_URL = /^(about:blank|chrome:\/\/newtab|chrome:\/\/new-tab-page|edge:\/\/newtab|brave:\/\/newtab)/;

function isSingletonError(err) {
  return /ProcessSingleton|SingletonLock|already running|browser has been closed|Target page, context or browser has been closed|Target closed/i.test(
    String(err?.message || "")
  );
}

function trackPage(page) {
  if (!pages.includes(page)) pages.push(page);
  page.on("close", () => {
    const idx = pages.indexOf(page);
    if (idx !== -1) {
      pages.splice(idx, 1);
      if (activePageIndex >= pages.length) activePageIndex = Math.max(0, pages.length - 1);
    }
  });
}

function attachContext(ctx) {
  context = ctx;
  ctx.on("page", trackPage);
}

async function launchPlaywright() {
  browser = await chromium.launch({ headless: false });
  attachContext(await browser.newContext({ viewport: VIEWPORT }));
  const page = await context.newPage();
  pages = [page];
  activePageIndex = 0;
  current = { browser: "playwright", profile: null, profileLabel: null, mode: "playwright" };
  console.log("[BROWSER] Launched isolated Playwright Chromium");
  return page;
}

async function openContext(browserName, dataDir, profileDir) {
  const spec = browserSpec(browserName);
  const args = ["--no-first-run", "--no-default-browser-check", "--start-maximized"];
  if (profileDir) args.push(`--profile-directory=${profileDir}`);

  const options = {
    headless: false,
    viewport: null,
    args,
    ignoreDefaultArgs: ["--enable-automation"]
  };
  if (spec.channel) options.channel = spec.channel;
  else options.executablePath = browserExecutable(browserName);

  const ctx = await chromium.launchPersistentContext(dataDir, options);
  browser = ctx.browser();
  attachContext(ctx);

  const existing = ctx.pages().filter(p => !p.isClosed());
  const blank = existing.find(p => BLANK_URL.test(p.url()));
  const ours = blank || (await ctx.newPage());
  pages = [...existing.filter(p => p !== ours), ours];
  for (const p of pages) trackPage(p);
  activePageIndex = pages.indexOf(ours);
  return ctx;
}

async function launchDedicated(browserName) {
  const spec = browserSpec(browserName);
  if (!spec) throw new Error(`unknown_browser:${browserName}`);
  if (!isBrowserInstalled(browserName)) throw new Error(`${browserName} is not installed on this computer`);

  try {
    await openContext(browserName, automationDataDir(browserName), null);
  } catch (err) {
    if (isSingletonError(err)) {
      throw new Error(
        `A Kairos ${spec.label} window from another session is still open. Close it and try again.`
      );
    }
    throw err;
  }
  current = { browser: browserName, profile: null, profileLabel: `Kairos ${spec.label}`, mode: "dedicated" };
  console.log(`[BROWSER] Launched private Kairos ${spec.label} (separate from your everyday ${spec.label})`);
  return pages[activePageIndex];
}

async function launchRealProfile(browserName, profileWanted) {
  const spec = browserSpec(browserName);
  if (!spec) throw new Error(`unknown_browser:${browserName}`);
  if (!isBrowserInstalled(browserName)) throw new Error(`${browserName} is not installed on this computer`);

  const profile = resolveProfile(browserName, profileWanted);
  if (!profile) {
    const available = listProfiles(browserName);
    const rendered = available.length
      ? available.map(p => `"${p.name}"${p.account ? ` (${p.account})` : ""}`).join(", ")
      : "none";
    throw new Error(
      `${spec.label} has no profile matching "${profileWanted}". ${spec.label} profiles are: ${rendered}. Use one of these exact names.`
    );
  }

  try {
    await openContext(browserName, spec.userDataDir, profile.directory);
  } catch (err) {
    if (isSingletonError(err)) {
      throw new Error(
        `${spec.label} is already running, so I can't open your real "${profile.name}" profile — Chromium only lets one process own a profile at a time. Close ${spec.label} completely (check the system tray) and ask again, or let me use the private Kairos ${spec.label} instead.`
      );
    }
    throw err;
  }
  current = { browser: browserName, profile: profile.directory, profileLabel: profile.name, mode: "real" };
  console.log(`[BROWSER] Launched ${spec.label} real profile "${profile.name}"`);
  return pages[activePageIndex];
}

export async function useBrowser(browserName, profileWanted = null) {
  await closeBrowser();
  if (!browserName || browserName === "playwright") {
    await launchPlaywright();
  } else if (profileWanted) {
    await launchRealProfile(browserName, profileWanted);
  } else {
    await launchDedicated(browserName);
  }
  preferred = { browser: current.browser, profile: current.mode === "real" ? current.profile : null };
  return { success: true, ...current };
}

export function currentBrowser() {
  return { ...current };
}

export async function launchBrowser() {
  if (browser && pages.length > 0 && !pages[activePageIndex]?.isClosed()) {
    return pages[activePageIndex];
  }
  const name = preferred.browser;
  if (name && name !== "playwright") {
    if (!isBrowserInstalled(name)) {
      console.log(`[BROWSER] ${name} not installed — using isolated browser`);
      return launchPlaywright();
    }
    try {
      return preferred.profile
        ? await launchRealProfile(name, preferred.profile)
        : await launchDedicated(name);
    } catch (err) {
      console.log(`[BROWSER] ${name} unavailable (${String(err.message).slice(0, 90)}) — using isolated browser`);
      return launchPlaywright();
    }
  }
  return launchPlaywright();
}

export async function getPage() {
  if (!browser || pages.length === 0) return launchBrowser();

  let page = pages[activePageIndex];
  if (!page || page.isClosed()) {
    const openIndex = pages.findIndex(p => p && !p.isClosed());
    if (openIndex !== -1) {
      activePageIndex = openIndex;
      page = pages[activePageIndex];
    } else {
      return launchBrowser();
    }
  }
  return page;
}

export function switchTab(index) {
  if (index < 0 || index >= pages.length) throw new Error("tab_not_found");
  activePageIndex = index;
  return pages[index];
}

export async function closeTab(index) {
  if (index < 0 || index >= pages.length) throw new Error("tab_not_found");
  await pages[index].close();
}

export async function listTabs() {
  const tabs = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (!page || page.isClosed()) continue;
    tabs.push({
      index: i,
      title: await page.title().catch(() => "unknown"),
      url: page.url(),
      active: i === activePageIndex
    });
  }
  return tabs;
}

export async function closeBrowser() {
  try {
    if (context) await context.close();
    else if (browser) await browser.close();
  } catch {}
  browser = null;
  context = null;
  pages = [];
  activePageIndex = 0;
  current = { browser: null, profile: null, profileLabel: null, mode: "closed" };
}

export async function restartBrowser() {
  await closeBrowser();
  return launchBrowser();
}

export function getCurrentPage() {
  return pages[activePageIndex];
}

export function activatePage(page) {
  const idx = pages.indexOf(page);
  if (idx !== -1) activePageIndex = idx;
  return idx;
}

export function isBrowserOpen() {
  return Boolean(browser && pages.length > 0 && !pages[activePageIndex]?.isClosed());
}

export async function createNewTab() {
  if (!context) await launchBrowser();
  const page = await context.newPage();
  trackPage(page);
  activePageIndex = pages.indexOf(page);
  return { success: true, index: activePageIndex };
}

export async function createNewWindow() {
  if (!context) await launchBrowser();
  const opener = await getPage();
  const before = new Set(context.pages());

  const popupPromise = context.waitForEvent("page", { timeout: 8000 }).catch(() => null);
  await opener.evaluate(() => window.open("about:blank", "_blank", "popup,width=1280,height=860")).catch(() => {});
  const popup = await popupPromise;

  const page = popup || context.pages().find(p => !before.has(p));
  if (!page) return { success: false, reason: "browser blocked the new window" };

  trackPage(page);
  activePageIndex = pages.indexOf(page);
  return { success: true, index: activePageIndex, window: true };
}
