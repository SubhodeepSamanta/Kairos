import {
  matchNavigation,
  matchFormFill,
  matchTabSwitch,
  matchReadPage,
  matchEvents,
  evaluateSuccessCriteria,
  matchSearch
} from "./stateMatchers.js";

export function verifyState({
  task,
  observation
}) {
  const browser = observation?.pageState || observation;
  const activeTab = browser?.activeTab || observation?.activeTab;
  const currentUrl = activeTab?.url || browser?.url || observation?.url;
  const currentTitle = activeTab?.title || browser?.title || observation?.title;

  console.log("task:", task);

  if (!browser || (!currentUrl && !currentTitle)) {
    return null;
  }

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

  const criteriaResult = evaluateSuccessCriteria(task, normalizedObservation);
  if (criteriaResult !== null) {
    if (criteriaResult === true) {
      return {
        achieved: true,
        reason: "Programmatic verification: All success criteria met."
      };
    } else {
      return null;
    }
  }

  const matchers = [
    matchSearch,
    matchEvents,
    matchFormFill,
    matchTabSwitch,
    matchReadPage,
    matchNavigation
  ];

  for (const matcher of matchers) {
    const result = matcher(task, normalizedObservation);
    if (result?.achieved) {
      return result;
    }
  }

  return null;
}
