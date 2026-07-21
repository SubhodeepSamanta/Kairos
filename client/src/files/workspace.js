import fs from "fs";
import path from "path";
import os from "os";

const MAX_READ_BYTES = 400000;
const MAX_TEXT_CHARS = 12000;
const MAX_ENTRIES = 80;

const TEXTUAL = new Set([
  ".txt", ".md", ".markdown", ".json", ".csv", ".tsv", ".log", ".yml", ".yaml",
  ".xml", ".html", ".htm", ".js", ".mjs", ".ts", ".jsx", ".tsx", ".py", ".java",
  ".c", ".h", ".cpp", ".cs", ".go", ".rs", ".rb", ".php", ".sh", ".sql", ".ini",
  ".env", ".cfg", ".conf", ".toml"
]);

const IMAGE = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tiff"]);

export function workspaceRoot() {
  return process.env.KAIROS_WORKSPACE || path.join(os.homedir(), "Documents", "Kairos");
}

export function downloadsRoot() {
  return path.join(workspaceRoot(), "downloads");
}

export function ensureWorkspace() {
  const root = workspaceRoot();
  fs.mkdirSync(downloadsRoot(), { recursive: true });
  return root;
}

export function resolveInWorkspace(relative) {
  const root = path.resolve(workspaceRoot());
  const target = path.resolve(root, String(relative || "").replace(/^[/\\]+/, ""));
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`outside the Kairos folder — I can only touch files under ${root}`);
  }
  return target;
}

export function describeKind(file) {
  const ext = path.extname(file).toLowerCase();
  if (TEXTUAL.has(ext)) return "text";
  if (IMAGE.has(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  return "other";
}

export function listFiles(relative = "") {
  ensureWorkspace();
  const dir = resolveInWorkspace(relative);
  if (!fs.existsSync(dir)) throw new Error(`there is no folder called "${relative || "."}" in the Kairos folder`);
  if (!fs.statSync(dir).isDirectory()) throw new Error(`"${relative}" is a file, not a folder`);

  const names = fs.readdirSync(dir).slice(0, MAX_ENTRIES);
  const entries = [];
  for (const name of names) {
    try {
      const stat = fs.statSync(path.join(dir, name));
      entries.push({
        name,
        directory: stat.isDirectory(),
        bytes: stat.isDirectory() ? null : stat.size,
        kind: stat.isDirectory() ? "folder" : describeKind(name)
      });
    } catch {}
  }
  return { root: workspaceRoot(), path: relative || ".", entries };
}

export function readTextFile(relative) {
  ensureWorkspace();
  const file = resolveInWorkspace(relative);
  if (!fs.existsSync(file)) throw new Error(`there is no file called "${relative}" in the Kairos folder`);
  const stat = fs.statSync(file);
  if (stat.isDirectory()) throw new Error(`"${relative}" is a folder — use list_files`);

  const kind = describeKind(file);
  if (kind === "pdf") {
    throw new Error("I cannot read PDFs yet — export it to text first, or screenshot a page and I will read that");
  }
  if (kind === "other") {
    throw new Error(`I cannot read ${path.extname(file) || "that kind of"} files — I read text files and images`);
  }
  if (kind === "image") return { kind: "image", file };

  if (stat.size > MAX_READ_BYTES) {
    throw new Error(`that file is ${Math.round(stat.size / 1024)}KB — too big to read whole`);
  }
  const text = fs.readFileSync(file, "utf8");
  return {
    kind: "text",
    file,
    text: text.slice(0, MAX_TEXT_CHARS),
    truncated: text.length > MAX_TEXT_CHARS,
    chars: text.length
  };
}

export function writeTextFile(relative, text) {
  ensureWorkspace();
  const file = resolveInWorkspace(relative);
  if (describeKind(file) !== "text") {
    throw new Error("I can only write text files (.txt, .md, .csv, .json and the like)");
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, String(text ?? ""), "utf8");
  return { file, bytes: Buffer.byteLength(String(text ?? ""), "utf8") };
}
