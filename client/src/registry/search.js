import {
  getInstalledApps
}
from "./apps.js";

export async function findApp(
  query
) {

  const apps =
    await getInstalledApps();

  query =
    query.toLowerCase()
      .trim();

  let exactMatch = null;

  let startsWithMatch = null;

  let includesMatch = null;

  for (
    const app of apps
  ) {

    const name =
      app.Name
        ?.toLowerCase()
        .trim();

    if (!name) {
      continue;
    }

    if (
      name === query
    ) {
      exactMatch = app;
      break;
    }

    if (
      !startsWithMatch &&
      name.startsWith(
        query
      )
    ) {
      startsWithMatch =
        app;
    }

    if (
      !includesMatch &&
      name.includes(
        query
      )
    ) {
      includesMatch =
        app;
    }
  }

  return (
    exactMatch ||
    startsWithMatch ||
    includesMatch ||
    null
  );
}