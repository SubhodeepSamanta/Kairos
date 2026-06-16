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

  const activeTab = browser?.activeTab || observation?.activeTab;
  const currentUrl = activeTab?.url || browser?.url || observation?.url;
  const currentTitle = activeTab?.title || browser?.title || observation?.title;

  console.log(
    "task:",
    task
  );

  if (!browser || (!currentUrl && !currentTitle)) {
    return null;
  }

  const matchers = [

    matchEvents,

    matchFormFill,

    matchTabSwitch,

    matchReadPage,

    matchNavigation
  ];

  // Create a normalized observation referencing the active tab context
  const normalizedObservation = {
    ...observation,
    url: currentUrl,
    title: currentTitle,
    pageState: {
      ...browser,
      url: currentUrl,
      title: currentTitle
    }
  };

  for (
    const matcher of matchers
  ) {

    const result =
      matcher(
        task,
        normalizedObservation
      );

    if (
      result?.achieved
    ) {

      return result;
    }
  }

  return null;
}