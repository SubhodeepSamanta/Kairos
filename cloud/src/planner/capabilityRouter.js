import {
  NavigationCapability,
  TabCapability,
  SearchCapability,
  ResultCapability,
  MediaCapability,
  FormCapability,
  ExtractionCapability
} from "./capabilities.js";

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
  
  for (const cap of CAPABILITIES) {
    if (blacklistedCapabilities.includes(cap.name)) {
      continue;
    }
    if (cap.canHandle(transition)) {
      console.log(`[ROUTER] Found matching capability: ${cap.name}`);
      return cap;
    }
  }
  
  console.log("[ROUTER] No matching capability found.");
  return null;
}
