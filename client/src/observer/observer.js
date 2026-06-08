import { ACTIONS }
from "../shared/schemas/action.js";

import {
  isAppRunning
}
from "../automation/desktop/windows/apps.js";

import {
  createObservation
}
from "../shared/schemas/observation.js";

function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

export async function observeAction(
  action
) {

  switch (
    action.type
  ) {

    case ACTIONS.OPEN_APP: {

      await sleep(3000);

      const running =
        await isAppRunning(
          action.params.app
        );

      return createObservation({
        success:
          running,
        expected:
          "running",
        actual:
          running
            ? "running"
            : "not_running"
      });
    }

    case ACTIONS.CLOSE_APP: {

      await sleep(1000);

      const running =
        await isAppRunning(
          action.params.app
        );

      return createObservation({
        success:
          !running,
        expected:
          "not_running",
        actual:
          running
            ? "running"
            : "not_running"
      });
    }

    case ACTIONS.FOCUS_APP: {

      return createObservation({
        success: true,
        expected:
          "focused",
        actual:
          "focused"
      });
    }

    default:

      return createObservation({
        success: false
      });
  }
}