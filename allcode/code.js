const fs = require("fs/promises");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const scanRoots = ["client", "cloud"].map((folder) =>
  path.join(rootDir, folder),
);
const outputFile = path.join(__dirname, "allcode.md");

const ignoredNames = new Set(["node_modules", "package-lock.json"]);
const binaryExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
  ".svg",
  ".zip",
  ".gz",
  ".tar",
  ".7z",
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
]);

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readDirectoryTree(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  entries.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { numeric: true }),
  );

  const collected = [];

  for (const entry of entries) {
    if (ignoredNames.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      collected.push(...(await readDirectoryTree(entryPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    collected.push(entryPath);
  }

  return collected;
}

function toDisplayPath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function getFence(content) {
  const matches = content.match(/`+/g) || [];
  const longestBacktickRun = matches.reduce(
    (max, run) => Math.max(max, run.length),
    0,
  );
  return "`".repeat(Math.max(3, longestBacktickRun + 1));
}

async function readFileAsMarkdown(filePath) {
  const buffer = await fs.readFile(filePath);

  if (binaryExtensions.has(path.extname(filePath).toLowerCase())) {
    return {
      kind: "binary",
      content: `Binary file omitted from markdown snapshot (${buffer.length} bytes).`,
    };
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return { kind: "text", content: text };
  } catch {
    return {
      kind: "binary",
      content: `Binary or non-UTF-8 file omitted from markdown snapshot (${buffer.length} bytes).`,
    };
  }
}

async function buildMarkdown() {
  const existingRoots = [];

  for (const rootPath of scanRoots) {
    if (await pathExists(rootPath)) {
      existingRoots.push(rootPath);
    }
  }

  const files = [];
  for (const rootPath of existingRoots) {
    files.push(...(await readDirectoryTree(rootPath)));
  }

  files.sort((left, right) =>
    toDisplayPath(left).localeCompare(toDisplayPath(right), undefined, {
      numeric: true,
    }),
  );

  const lines = [];
  lines.push("# All Code Snapshot");
  lines.push("");
  lines.push(
    `Generated from: ${scanRoots.map((folder) => path.relative(rootDir, folder).split(path.sep).join("/")).join(", ")}`,
  );
  lines.push("");
  lines.push("Excluded: node_modules, package-lock.json");
  lines.push("");

  if (files.length === 0) {
    lines.push("No files found in client or cloud.");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("## File List");
  lines.push("");

  for (const filePath of files) {
    lines.push(`- ${toDisplayPath(filePath)}`);
  }

  lines.push("");
  lines.push("## Contents");
  lines.push("");

  for (const filePath of files) {
    const displayPath = toDisplayPath(filePath);
    const fileData = await readFileAsMarkdown(filePath);

    lines.push(`### ${displayPath}`);
    lines.push("");

    if (fileData.kind === "text") {
      const fence = getFence(fileData.content);
      lines.push(`${fence}text`);
      lines.push(fileData.content.replace(/\s+$/, ""));
      lines.push(fence);
    } else {
      lines.push(fileData.content);
    }

    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const markdown = await buildMarkdown();
  await fs.writeFile(outputFile, markdown + "\n", "utf8");
  console.log(
    `Wrote ${path.relative(rootDir, outputFile).split(path.sep).join("/")}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
