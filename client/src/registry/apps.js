import { exec } from "child_process";

let cache = null;

export async function getInstalledApps() {

  if (cache) {
    return cache;
  }

  const command =
    'powershell "Get-StartApps | Select-Object Name,AppID | ConvertTo-Json"';

  return new Promise(
    (resolve) => {

      exec(
        command,
        {
          maxBuffer:
            1024 * 1024 * 10
        },
        (
          error,
          stdout
        ) => {

          if (
            error ||
            !stdout
          ) {
            cache = [];
            resolve(cache);
            return;
          }

          try {

            const parsed =
              JSON.parse(
                stdout
              );

            cache =
              Array.isArray(
                parsed
              )
                ? parsed
                : [parsed];

            resolve(
              cache
            );

          }

          catch {

            cache = [];

            resolve(
              cache
            );
          }
        }
      );
    }
  );
}