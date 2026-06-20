import { matchAuthForm } from "./eventMatchers.js";

export function verifyEvents({
  task,
  observation
}) {
  const matchers = [matchAuthForm];

  for (const matcher of matchers) {
    const result = matcher(task, observation);
    if (result?.achieved) {
      console.log("EVENT MATCH:", result);
      return result;
    }
  }

  return null;
}
