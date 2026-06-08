import {
  findApp
}
from "./src/registry/search.js";

const app =
  await findApp(
    "spotify"
  );

console.log(app);