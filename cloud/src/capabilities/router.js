import {
  NavigationCapability,
  TabCapability,
  SearchCapability,
  ResultCapability,
  MediaCapability,
  FormCapability,
  ExtractionCapability
} from "./index.js";

const CAPABILITIES = [
  TabCapability,
  ResultCapability,
  SearchCapability,
  MediaCapability,
  FormCapability,
  ExtractionCapability,
  NavigationCapability
];

export function routeCapability(transition, blacklistedCapabilities = []) {
  console.log(`[ROUTER] Routing transition: "${transition.id}" (desiredState: "${transition.desiredState}")`);
  
  let bestCap = null;
  let bestScore = -1;

  for (const cap of CAPABILITIES) {
    if (blacklistedCapabilities.includes(cap.name)) {
      console.log(`[ROUTER] Capability ${cap.name} is blacklisted. Bypassing.`);
      continue;
    }
    if (cap.canHandle(transition)) {
      const score = cap.successRate * cap.confidence;
      console.log(`[ROUTER] Capability ${cap.name} matched. Score: ${score.toFixed(2)} (successRate=${cap.successRate.toFixed(2)}, confidence=${cap.confidence.toFixed(2)})`);
      if (score > bestScore) {
        bestCap = cap;
        bestScore = score;
      }
    }
  }
  
  if (bestCap) {
    console.log(`[ROUTER] Routed to highest confidence capability: ${bestCap.name} (score: ${bestScore.toFixed(2)})`);
    return bestCap;
  }
  
  console.log("[ROUTER] No matching capability found.");
  return null;
}
