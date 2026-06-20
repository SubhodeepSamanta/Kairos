import {
  NavigationCapability,
  TabCapability,
  SearchCapability,
  ResultCapability,
  MediaCapability,
  FormCapability,
  ExtractionCapability
} from "./index.js";
import { normalizeTransition, toLegacyCapabilityTransition } from "../world/stateNormalization.js";

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
  console.log("[CAPABILITY ROUTER INPUT]");
  console.log(JSON.stringify({ transition, blacklistedCapabilities }, null, 2));

  const normalizedTransition = normalizeTransition(transition);
  const capabilityTransition = toLegacyCapabilityTransition(normalizedTransition);

  console.log(`[ROUTER] Routing transition: "${normalizedTransition.id}" (desiredState: "${normalizedTransition.desiredState}")`);
  
  let bestCap = null;
  let bestScore = -1;

  for (const cap of CAPABILITIES) {
    if (blacklistedCapabilities.includes(cap.name)) {
      console.log(`[ROUTER] Capability ${cap.name} is blacklisted. Bypassing.`);
      continue;
    }
    if (cap.canHandle(normalizedTransition) || cap.canHandle(capabilityTransition)) {
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
    console.log("[CAPABILITY ROUTER OUTPUT]");
    console.log(JSON.stringify({ name: bestCap.name, successRate: bestCap.successRate, confidence: bestCap.confidence }, null, 2));

    return {
      ...bestCap,
      execute(browserTransition, browserState) {
        return bestCap.execute(toLegacyCapabilityTransition(browserTransition), browserState);
      },
      verify(browserTransition, observation) {
        return bestCap.verify(toLegacyCapabilityTransition(browserTransition), observation);
      },
      recover(failure, browserTransition) {
        return bestCap.recover(failure, toLegacyCapabilityTransition(browserTransition));
      }
    };
  }
  
  console.log("[ROUTER] No matching capability found.");
  console.log("[CAPABILITY ROUTER OUTPUT] null");
  return null;
}
