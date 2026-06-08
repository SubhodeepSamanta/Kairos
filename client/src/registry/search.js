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
    query.toLowerCase();

  for (
    const app of apps
  ) {

    const name =
      app.Name
        ?.toLowerCase();

    if (
      name &&
      name.includes(
        query
      )
    ) {
      return app;
    }
  }

  return null;
}