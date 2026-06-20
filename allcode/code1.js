const fs = require("fs/promises");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const filesToCollect = [
"cloud/src/world/currentStateResolver.js",
"cloud/src/world/stateNormalization.js",
"cloud/src/capabilities/selection/SelectionCapability.js",
"cloud/src/capabilities/router.js",
"cloud/src/agent/loop/transitionLoop.js",
];

const outputFile = path.join(__dirname, "code.md");

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

function getLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".js") return "javascript";
  if (ext === ".json") return "json";
  if (ext === ".md") return "markdown";
  return "text";
}

async function buildMarkdown() {
  const lines = [];
  lines.push("");
  lines.push("## File List");
  lines.push("");

  for (const relPath of filesToCollect) {
    lines.push(`- [${relPath}](file:///c:/Users/USER/Desktop/Kairos/${relPath})`);
  }

  lines.push("");
  lines.push("## Contents");
  lines.push("");

  for (const relPath of filesToCollect) {
    const filePath = path.join(rootDir, relPath);
    try {
      const content = await fs.readFile(filePath, "utf8");
      const displayPath = toDisplayPath(filePath);
      const language = getLanguage(filePath);
      const fence = getFence(content);

      lines.push(`### ${displayPath}`);
      lines.push("");
      lines.push(`${fence}${language}`);
      lines.push(content.replace(/\s+$/, ""));
      lines.push(fence);
      lines.push("");
    } catch (err) {
      lines.push(`### ${relPath} (Error Reading File)`);
      lines.push("");
      lines.push(`Could not read file: ${err.message}`);
      lines.push("");
    }
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
