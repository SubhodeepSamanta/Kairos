import { spawn, exec } from "child_process";
import { findApp } from "../../../registry/search.js";

const PROCESS_NAMES = {
    notepad: "notepad.exe",
    calculator: "CalculatorApp.exe",
    chrome: "chrome.exe"
};

export async function openApp(app) {

    const found =
        await findApp(app);
    console.log(
        "FOUND APP:",
        found
    );
    if (found?.AppID) {

        spawn(
            "explorer.exe",
            [
                `shell:AppsFolder\\${found.AppID}`
            ],
            {
                detached: true,
                stdio: "ignore"
            }
        ).unref();

        return {
            success: true,
            app
        };
    }

    const processName =
        PROCESS_NAMES[
        app.toLowerCase()
        ];

    if (!processName) {
        throw new Error(
            `App not found: ${app}`
        );
    }

    spawn(
        processName,
        [],
        {
            detached: true,
            stdio: "ignore"
        }
    ).unref();

    return {
        success: true,
        app
    };
}

export async function closeApp(app) {

    const processName =
        PROCESS_NAMES[
        app.toLowerCase()
        ];

    if (!processName) {
        return {
            success: false,
            app,
            reason:
                "process_unknown"
        };
    }

    return new Promise(
        (
            resolve,
            reject
        ) => {

            exec(
                `taskkill /F /IM ${processName}`,
                (error) => {

                    if (error) {

                        resolve({
                            success: false,
                            app
                        });

                        return;
                    }

                    resolve({
                        success: true,
                        app
                    });
                }
            );
        }
    );
}

export async function focusApp(app) {

    return {
        success: true,
        app
    };
}

export async function isAppRunning(
    app
) {

    const processName =
        PROCESS_NAMES[
        app.toLowerCase()
        ];

    if (!processName) {
        return false;
    }

    return new Promise(
        (resolve) => {

            exec(
                `tasklist /FI "IMAGENAME eq ${processName}"`,
                (
                    error,
                    stdout
                ) => {

                    if (
                        error
                    ) {
                        resolve(
                            false
                        );
                        return;
                    }

                    resolve(
                        stdout
                            .toLowerCase()
                            .includes(
                                processName.toLowerCase()
                            )
                    );
                }
            );
        }
    );
}