import { plannerCore } from "./core/plannerCore.js";
import { outputRules } from "./core/outputRules.js";
import { actionSchema } from "./core/actionSchema.js";
import { browserPrompt } from "./browser/browser.js";
import { multitabPrompt } from "./multitab/multitab.js";
import { extractionPrompt } from "./extraction/extraction.js";
import { recoveryPrompt } from "./recovery/recovery.js";

export function buildSystemPrompt(
  task,
  memoryContext = "",
  browserContext = "",
  worldContext = ""
) {
  const sections = [];

  sections.push(plannerCore);
  sections.push(browserPrompt);

  const taskLower = (task?.objective || "").toLowerCase();
  
  if (browserContext.includes("Page Type:") || browserContext.includes("purpose:")) {
    sections.push(`Semantic elements classification:
- Elements now have a "purpose" attribute (e.g. purpose: "search_input", purpose: "login_button").
- The current page has a "Page Type" (e.g. Page Type: result_page).
- Prioritize elements with a matching purpose for your objective (e.g. type search queries into inputs with purpose: "search_input").`);
  }
 
  if (taskLower.includes("video") || taskLower.includes("media") || taskLower.includes("watch") || taskLower.includes("play") || browserContext.includes("media_site")) {
    sections.push(`Video Search Guidelines:
- Ignore Shorts: do not click elements containing duration labels under 1 minute or containing the word "Shorts" unless told.
- Prefer livestreams or long-duration (>1h) videos when requested: look for "LIVE", "livestream", or duration labels like "1:00:00" or similar, and click the matching video link.
- If on a search results page and the objective is to play/open a video, you MUST click one of the video title links. Do NOT type into the search box again or refresh if watch/video links are visible.`);
  }

  if (taskLower.includes("tab") || taskLower.includes("switch") || taskLower.includes("another site") || taskLower.includes("second site")) {
    sections.push(multitabPrompt);
  }

  if (taskLower.includes("extract") || taskLower.includes("scrape") || taskLower.includes("find details")) {
    sections.push(extractionPrompt);
  }

  sections.push(recoveryPrompt);
  sections.push(outputRules);
  sections.push(actionSchema);

  let finalPrompt = sections.join("\n\n");

  finalPrompt += `\n\nCurrent task:

${JSON.stringify(task, null, 2)}

Current browser state:

${browserContext}

World model (accumulated knowledge):

${worldContext || "No prior context."}

Known user memories:

${memoryContext}
`;

  return finalPrompt;
}
