import { createGoal } from "./src/shared/schemas/goal.js";
import { reasonNextActions } from "./src/reasoning/browserReasoner.js";

const goal = createGoal("open youtube.com");
console.log("Goal created:", goal.objective);

const pageUnderstanding = {
  pagePurpose: "search interface",
  importantElements: [],
  constraints: []
};

const actions = reasonNextActions({
  goal: goal.objective,
  pageUnderstanding,
  worldState: {}
});

console.log("Next action candidates:", JSON.stringify(actions, null, 2));