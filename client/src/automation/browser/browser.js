import { chromium } from "playwright";
import { browserSpec, browserExecutable, resolveProfile, isBrowserInstalled, listProfiles } from "./profiles.js";

const DEFAULT_BROWSER = process.env.DEFAULT_BROWSER || "chrome";

let browser = null;
let context = null;
let pages = [];
let activePageIndex = 0;
let preferred = { browser: DEFAULT_BROWSER, profile: null };
let current = { browser: "playwright", profile: null, profileLabel: null };

const VIEWPORT = { width: 1440, height: 900 };

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
  current = { browser: "playwright", profile: null, profileLabel: null };
  console.log("[BROWSER] Launched isolated Playwright Chromium");
  return page;
}

async function launchReal(browserName, profileWanted) {
  const spec = browserSpec(browserName);
  if (!spec) throw new Error(`unknown_browser:${browserName}`);
  if (!isBrowserInstalled(browserName)) throw new Error(`${browserName} is not installed on this computer`);

  const profile = resolveProfile(browserName, profileWanted);
  if (profileWanted && !profile) {
    const available = listProfiles(browserName);
    const rendered = available.length
      ? available.map(p => `"${p.name}"${p.account ? ` (${p.account})` : ""}`).join(", ")
      : "none";
    throw new Error(
      `${spec.label} has no profile matching "${profileWanted}". ${spec.label} profiles are: ${rendered}. Use one of these exact names, or omit profile for the first one.`
    );
  }

  const args = [];
  if (profile) args.push(`--profile-directory=${profile.directory}`);

  const options = { headless: false, viewport: VIEWPORT, args };
  if (spec.channel) options.channel = spec.channel;
  else options.executablePath = browserExecutable(browserName);

  try {
    const ctx = await chromium.launchPersistentContext(spec.userDataDir, options);
    browser = ctx.browser();
    attachContext(ctx);
    pages = ctx.pages().filter(p => !p.isClosed());
    if (!pages.length) pages = [await ctx.newPage()];
    for (const p of pages) trackPage(p);
    activePageIndex = 0;
    current = {
      browser: browserName,
      profile: profile?.directory || null,
      profileLabel: profile?.name || null
    };
    console.log(`[BROWSER] Launched ${spec.label}${profile ? ` profile "${profile.name}"` : ""}`);
    return pages[0];
  } catch (err) {
    const msg = String(err.message || "");
    if (/ProcessSingleton|SingletonLock|already running|Failed to create a ProcessSingleton/i.test(msg)) {
      throw new Error(
        `${spec.label} is already open, so I cannot drive your real profile. Close ${spec.label} completely and try again, or ask me to use the isolated browser instead.`
      );
    }
    throw err;
  }
}

export async function useBrowser(browserName, profileWanted = null) {
  await closeBrowser();
  if (!browserName || browserName === "playwright") {
    await launchPlaywright();
  } else {
    await launchReal(browserName, profileWanted);
  }
  preferred = { browser: current.browser, profile: current.profile };
  return { success: true, ...current };
}

export function currentBrowser() {
  return { ...current };
}

export async function launchBrowser() {
  if (browser && pages.length > 0 && !pages[activePageIndex]?.isClosed()) {
    return pages[activePageIndex];
  }
  if (preferred.browser && preferred.browser !== "playwright") {
    try {
      return await launchReal(preferred.browser, preferred.profile);
    } catch (err) {
      console.log(`[BROWSER] ${preferred.browser} unavailable (${err.message.slice(0, 90)}) — using isolated browser`);
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
}

export async function restartBrowser() {
  await closeBrowser();
  return launchBrowser();
}

export function getCurrentPage() {
  return pages[activePageIndex];
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
