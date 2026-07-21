import path from "path";
import { listFiles, readTextFile, writeTextFile, workspaceRoot } from "./workspace.js";

const MAX_OCR_CHARS = 4000;

function formatListing({ root, path: where, entries }) {
  if (!entries.length) return `${root}${where === "." ? "" : `\\${where}`} is empty`;
  const lines = entries.map(e =>
    e.directory ? `  ${e.name}/` : `  ${e.name}  (${e.kind}, ${Math.max(1, Math.round(e.bytes / 1024))}KB)`
  );
  return `in ${root}${where === "." ? "" : `\\${where}`}:\n${lines.join("\n")}`;
}

async function readImage(file) {
  const { readTextFromImage } = await import("../automation/browser/actions/observation/visionReader.js");
  const text = await readTextFromImage(file);
  const clean = String(text || "").trim();
  if (!clean) throw new Error("I could not make out any text in that image");
  return clean.slice(0, MAX_OCR_CHARS);
}

export async function executeFileAction(action) {
  const params = action.params || {};

  if (action.type === "list_files") {
    const listing = listFiles(params.path || "");
    return { success: true, listing: formatListing(listing), count: listing.entries.length };
  }

  if (action.type === "read_file") {
    const result = readTextFile(params.path);
    if (result.kind === "image") {
      const text = await readImage(result.file);
      return { success: true, text, source: path.basename(result.file), via: "image" };
    }
    return {
      success: true,
      text: result.text,
      source: path.basename(result.file),
      via: "text",
      truncated: result.truncated
    };
  }

  if (action.type === "write_file") {
    const { file, bytes } = writeTextFile(params.path, params.text);
    return { success: true, written: path.relative(workspaceRoot(), file), bytes };
  }

  return { success: false, reason: `unknown file action ${action.type}` };
}

export const FILE_ACTIONS = new Set(["list_files", "read_file", "write_file"]);
