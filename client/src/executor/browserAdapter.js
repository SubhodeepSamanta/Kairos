import { ACTIONS } from "../shared/schemas/action.js";
import { navigate } from "../automation/browser/actions/navigation/navigate.js";
import { readPage } from "../automation/browser/actions/observation/read.js";
import { getContext } from "../automation/browser/actions/getContext.js";
import { typeText } from "../automation/browser/actions/input/type.js";
import { clickText } from "../automation/browser/actions/input/click.js";
import { selectOption } from "../automation/browser/actions/input/selectOption.js";
import { openForUser } from "../automation/browser/actions/openForUser.js";
import { goBack } from "../automation/browser/actions/navigation/back.js";
import { goForward } from "../automation/browser/actions/navigation/forward.js";
import { refreshPage } from "../automation/browser/actions/navigation/refresh.js";
import { getTabs } from "../automation/browser/actions/listTabs.js";
import { newTab } from "../automation/browser/actions/tabs/newTab.js";
import { createNewWindow } from "../automation/browser/browser.js";
import { switchBrowserTab } from "../automation/browser/actions/tabs/switchTab.js";
import { closeBrowserTab } from "../automation/browser/actions/tabs/closeTab.js";
import { pressKey } from "../automation/browser/actions/input/pressKey.js";
import { waitSeconds } from "../automation/browser/actions/wait.js";
import { scrollPage } from "../automation/browser/actions/scroll.js";
import { extractLinks } from "../automation/browser/actions/observation/extractLinks.js";
import { extractMetadata } from "../automation/browser/actions/observation/extractMetadata.js";
import { takeScreenshot } from "../automation/browser/actions/observation/screenshot.js";
import { restartCurrentBrowser } from "../automation/browser/restartBrowser.js";
import { closeCurrentBrowser } from "../automation/browser/closeBrowser.js";
import { useBrowser, currentBrowser } from "../automation/browser/browser.js";
import { describeBrowsers, installedBrowsers } from "../automation/browser/profiles.js";

export async function executeBrowserAction(action) {
  switch (action.type) {
    case ACTIONS.NAVIGATE:
      return await navigate(action.params.url);
    case ACTIONS.TYPE:
      return await typeText(action.params.text, action.params.element, action.params.submit === true);
    case ACTIONS.CLICK:
      return await clickText(action.params.text, action.params.element);
    case ACTIONS.SELECT_OPTION:
      return await selectOption(action.params.element, action.params.value);
    case ACTIONS.OPEN_FOR_USER:
      return await openForUser(action.params.url);
    case ACTIONS.READ_UI:
      return await readPage();
    case ACTIONS.GET_BROWSER_CONTEXT:
      return await getContext();
    case ACTIONS.CLOSE_BROWSER:
      return await closeCurrentBrowser();
    case ACTIONS.BACK:
      return await goBack();
    case ACTIONS.FORWARD:
      return await goForward();
    case ACTIONS.REFRESH:
      return await refreshPage();
    case ACTIONS.LIST_TABS:
      return await getTabs();
    case ACTIONS.WAIT:
      return await waitSeconds(action.params.seconds);
    case ACTIONS.SCROLL:
      return await scrollPage(action.params.direction);
    case ACTIONS.EXTRACT_LINKS:
      return await extractLinks();
    case ACTIONS.SWITCH_TAB:
      return await switchBrowserTab(action.params.index);
    case ACTIONS.CLOSE_TAB:
      return await closeBrowserTab(action.params.index);
    case ACTIONS.PRESS_KEY:
      return await pressKey(action.params.key);
    case ACTIONS.RESTART_BROWSER:
      return await restartCurrentBrowser();
    case ACTIONS.NEW_TAB:
      return await newTab();
    case ACTIONS.NEW_WINDOW:
      return await createNewWindow();
    case ACTIONS.EXTRACT_METADATA:
      return await extractMetadata();
    case ACTIONS.SCREENSHOT:
      return await takeScreenshot();
    case ACTIONS.LIST_BROWSERS:
      return { success: true, browsers: describeBrowsers(), installed: installedBrowsers(), active: currentBrowser() };
    case ACTIONS.USE_BROWSER:
      try {
        return await useBrowser(action.params.browser, action.params.profile || null);
      } catch (err) {
        return { success: false, reason: err.message };
      }
    case "extract_data":
      return await readPage();
    default:
      throw new Error(`Unsupported browser action: ${action.type}`);
  }
}
