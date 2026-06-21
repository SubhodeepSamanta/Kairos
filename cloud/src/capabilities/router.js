import {
  NavigationExecutor,
  ClickExecutor,
  TypeExecutor,
  ScrollExecutor,
  ExtractExecutor,
  TabExecutor
} from "./index.js";

const CAPABILITIES = [
  TabExecutor,
  ExtractExecutor,
  ScrollExecutor,
  TypeExecutor,
  ClickExecutor,
  NavigationExecutor
];

export function routeCapability(actionType, blacklistedCapabilities = []) {
  console.log(`[ROUTER] Routing actionType: "${actionType}"`);
  
  let bestCap = null;
  let bestScore = -1;

  for (const cap of CAPABILITIES) {
    if (blacklistedCapabilities.includes(cap.name)) {
      console.log(`[ROUTER] Capability ${cap.name} is blacklisted. Bypassing.`);
      continue;
    }
    if (cap.canHandle(actionType)) {
      const score = cap.successRate * cap.confidence;
      if (score > bestScore) {
        bestCap = cap;
        bestScore = score;
      }
    }
  }
  
  if (bestCap) {
    console.log(`[ROUTER] Routed to executor: ${bestCap.name} (score: ${bestScore.toFixed(2)})`);
    return bestCap;
  }
  
  console.log("[ROUTER] No matching capability found.");
  return null;
}
