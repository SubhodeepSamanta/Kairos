import { ACTIONS } from "../shared/schemas/action.js";
import { openApp, closeApp, focusApp, listApps } from "../automation/desktop/windows/apps.js";

export async function executeDesktopAction(action) {
  switch (action.type) {
    case ACTIONS.OPEN_APP:
      return await openApp(action.params.app);
    case ACTIONS.CLOSE_APP:
      return await closeApp(action.params.app);
    case ACTIONS.FOCUS_APP:
      return await focusApp(action.params.app);
    case ACTIONS.LIST_APPS: {
      const apps = await listApps();
      return { success: true, apps };
    }
    default:
      throw new Error(`Unsupported desktop action: ${action.type}`);
  }
}
