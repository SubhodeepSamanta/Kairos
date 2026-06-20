import { navigate } from "./src/automation/browser/actions/navigation/navigate.js";
import { readPage } from "./src/automation/browser/actions/observation/read.js";

await navigate(
  "https://google.com"
);

const page =
  await readPage();

console.log(page);