import { findApp } from "./src/registry/search.js";

console.log(
  await findApp("chrome")
);