import { chromium } from 'playwright'

let browser = null

async function getBrowser() {
  if (browser?.isConnected()) return browser
  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  })
  browser.on('disconnected', () => {
    browser = null
  })
  return browser
}

export async function webExtract(url) {
  const b = await getBrowser()
  const page = await b.newPage()

  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })

    await page.waitForTimeout(800)

    const text = await page.evaluate(() => {
      document.querySelectorAll(
        'script,style,nav,footer,header,aside,' +
        'iframe,[class*="cookie"],[class*="popup"],' +
        '[class*="modal"],[class*="banner"],' +
        '[class*="ad-"],[id*="ad-"],[aria-hidden="true"]'
      ).forEach(el => el.remove())

      return (document.body?.innerText || '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{3,}/g, ' ')
        .trim()
        .slice(0, 6000)
    })

    if (!text || text.length < 50) {
      return { 
        success: false, 
        error: 'Page had no readable content',
        url 
      }
    }

    return { success: true, text, url }
  } catch (err) {
    return { success: false, error: err.message, url }
  } finally {
    await page.close()
  }
}

export async function shutdownBrowser() {
  if (browser) {
    await browser.close()
    browser = null
  }
}
