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
    sections.push(`Content Page Guidelines:
- When on a results/search page and the objective is view/open/play a result, click one of the content links. Do NOT type into a search box again or refresh if content links are visible.
- Look at each element's semanticType (e.g., "content_item", "primary_content", "search_input") and purpose (e.g., "search_input", "primary_content") to determine the right element to interact with.
- If the objective mentions a specific item (e.g., "first result", "top result", a specific title), match it against element labels. Otherwise, pick the most relevant content item.`);
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

  const taskSummary = {
    objective: task.objective || task,
    completedSubObjectives: task.workflowMemory?.completedSubObjectives || [],
    currentSubObjective: task.workflowMemory?.currentSubObjective || ""
  };

  finalPrompt += `\n\nCurrent task:
${JSON.stringify(taskSummary, null, 2)}

Current browser state:
${browserContext}

World model:
${worldContext || "No prior context."}

${memoryContext ? `User memories:\n${memoryContext}\n` : ""}`;

  return finalPrompt;
}
