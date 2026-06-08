import { ACTIONS } from "../shared/schemas/action.js";
import { createObservation } from "../shared/schemas/observation.js";
import { isAppRunning } from "../automation/desktop/windows/apps.js";

export async function observeAction(action) {
  switch (action.type) {
    case ACTIONS.OPEN_APP: {
      const running = await isAppRunning(
        action.params.app
      );

      return createObservation({
        success: running,
        expected: `${action.params.app}_running`,
        actual: running
          ? `${action.params.app}_running`
          : `${action.params.app}_not_running`
      });
    }

    default:
      return createObservation({
        success: false,
        expected: "supported_action",
        actual: "unsupported_action"
      });
  }
}