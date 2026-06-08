import { executePlan } from "./src/executor/executor.js";
import { observeAction } from "./src/observer/observer.js";

const action = {
  type: "open_app",
  params: {
    app: "notepad"
  }
};

const plan = {
  actions: [action]
};

await executePlan(plan);

setTimeout(async () => {

  const observation =
    await observeAction(action);

  console.log(
    JSON.stringify(
      observation,
      null,
      2
    )
  );

}, 1000);