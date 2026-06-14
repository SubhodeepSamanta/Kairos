import {
  matchAuthForm,
  matchMediaLoaded
} from "./eventMatchers.js";

export function verifyEvents({
  intent,
  observation
}) {

const matchers = [

  matchAuthForm,

  matchMediaLoaded
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