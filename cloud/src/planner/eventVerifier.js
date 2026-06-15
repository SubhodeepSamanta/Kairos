import {
  matchAuthForm,
  matchMediaLoaded
} from "./eventMatchers.js";

export function verifyEvents({
  task,
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
        task,
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