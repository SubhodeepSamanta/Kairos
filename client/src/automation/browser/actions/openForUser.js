import { execFile } from "child_process";

export function openForUser(url) {
  const target = String(url || "").trim();
  if (!/^https?:\/\/[^\s"]+$/i.test(target)) {
    return Promise.resolve({ success: false, reason: "open_for_user needs a full http(s) url" });
  }
  return new Promise((resolve) => {
    execFile("rundll32", ["url.dll,FileProtocolHandler", target], { windowsHide: true }, (err) => {
      if (err) {
        resolve({ success: false, reason: `could not hand the url to the default browser: ${String(err.message).slice(0, 80)}` });
      } else {
        resolve({ success: true, opened: target });
      }
    });
  });
}
