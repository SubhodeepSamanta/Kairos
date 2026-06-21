import { generateActions } from "./actionGenerator.js";
import { rankActions } from "./actionSelector.js";

export function reasonNextActions({
  goal,
  pageUnderstanding,
  browserState,
  history = []
}) {
  console.log(`[REASONER] Reasoning next action for goal: "${goal}" on page classified as "${pageUnderstanding.pagePurpose}"`);
  
  // Generate candidate actions
  const candidates = generateActions(goal, pageUnderstanding, browserState);
  
  // Rank the actions
  const ranked = rankActions(goal, pageUnderstanding, candidates, history);
  
  console.log(`[REASONER] Generated ${candidates.length} candidates. Top candidate: "${ranked[0]?.label || ranked[0]?.type}" with score ${ranked[0]?.score}`);
  
  return ranked;
}
