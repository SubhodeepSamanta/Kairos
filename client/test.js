import { navigate } from "./src/automation/browser/actions/navigate.js";
import { readPage } from "./src/automation/browser/actions/read.js";

await navigate(
  "https://google.com"
);

const page =
  await readPage();

console.log(page);