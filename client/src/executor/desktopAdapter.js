import { ACTIONS } from "../shared/schemas/action.js";
import { openApp, closeApp, focusApp, listApps } from "../automation/desktop/windows/apps.js";
import { readDesktop } from "../automation/desktop/driver.js";
import { clickElement, typeInto, setToggle, selectMenu, pressKeys } from "../automation/desktop/windows/act.js";

export async function executeDesktopAction(action) {
  const p = action.params || {};
  switch (action.type) {
    case ACTIONS.OPEN_APP:
      return await openApp(p.app);
    case ACTIONS.CLOSE_APP:
      return await closeApp(p.app);
    case ACTIONS.FOCUS_APP:
      return await focusApp(p.app);
    case ACTIONS.LIST_APPS: {
      const apps = await listApps();
      return { success: true, apps };
    }
    case ACTIONS.READ_DESKTOP:
      return await readDesktop();
    case ACTIONS.CLICK_ELEMENT:
      return await clickElement(p.element);
    case ACTIONS.TYPE_INTO:
      return await typeInto(p.element, p.text, p.submit === true);
    case ACTIONS.SET_TOGGLE:
      return await setToggle(p.element, p.on);
    case ACTIONS.SELECT_MENU:
      return await selectMenu(p.element, p.value);
    case ACTIONS.PRESS_KEYS:
      return await pressKeys(p.keys);
    default:
      throw new Error(`Unsupported desktop action: ${action.type}`);
  }
}
