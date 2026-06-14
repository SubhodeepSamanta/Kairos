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
  intent,
  observation
}) {

  const browser =
    observation?.pageState;

  console.log(
    "INTENT:",
    intent
  );

  if (!browser) {
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
        intent,
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