import {
  matchUrlChanged,
  matchSearchForm,
  matchNewElements
} from "./eventMatchers.js";

export function verifyEvents({
  intent,
  observation
}) {

  const matchers = [

    matchSearchForm,

    matchUrlChanged,

    matchNewElements
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

      console.log(
        "EVENT MATCH:",
        result
      );

      return result;
    }
  }

  return null;
}