import {
  matchNavigation,
  matchFormFill,
  matchTabSwitch,
  matchReadPage
} from "./stateMatchers.js";

import {
  matchEvents
} from "./stateMatchers.js";

export function verifyState({
  task,
  observation
}) {

  const browser =
    observation?.pageState || observation;

  console.log(
    "task:",
    task
  );

  if (!browser || (!browser.url && !browser.title)) {
    return null;
  }

  const matchers = [

    matchEvents,

    matchFormFill,

    matchTabSwitch,

    matchReadPage,

    matchNavigation
  ];

  for (
    const matcher of matchers
  ) {

    const result =
      matcher(
        task,
        observation
      );

    if (
      result?.achieved
    ) {

      return result;
    }
  }

  return null;
}