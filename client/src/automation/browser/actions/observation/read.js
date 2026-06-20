import { getPage, listTabs } from "../../browser.js";
import { updateBrowserContext } from "../../context.js";
import { clearRegistry } from "../../elements/registry.js";
import { classifyPage } from "../classifier/index.js";
import { preparePage, extractPageText } from "./pageReader.js";
import { readButtons } from "./buttonReader.js";
import { readInputs } from "./inputReader.js";
import { readLinks } from "./linkReader.js";
import { readForms } from "./formReader.js";
import { scoreObservation } from "./qualityScorer.js";

export async function readPage() {
  const page = await getPage();
  const title = await page.title().catch(() => "unknown");
  const url = page.url();
  
  clearRegistry();

  await preparePage(page);

  const buttons = await readButtons(page);
  const inputs = await readInputs(page);
  const links = await readLinks(page);
  const forms = await readForms(page);
  const text = await extractPageText(page);

  const PROTECTED_PURPOSES = [
    "search_input",
    "search_launcher",
    "search_button",
    "video_link",
    "product_link",
    "login_button",
    "submit_button",
    "login_email",
    "login_password"
  ];

  const sortProtectedFirst = (a, b) => {
    const aProtected = PROTECTED_PURPOSES.includes(a.purpose);
    const bProtected = PROTECTED_PURPOSES.includes(b.purpose);
    if (aProtected && !bProtected) return -1;
    if (!aProtected && bProtected) return 1;
    return b.confidence - a.confidence;
  };

  const sortedButtons = [...buttons].sort(sortProtectedFirst);
  const sortedInputs = [...inputs].sort(sortProtectedFirst);
  const sortedLinks = [...links].sort(sortProtectedFirst);

  const cappedButtons = sortedButtons.slice(0, 50);
  const cappedInputs = sortedInputs.slice(0, 20);
  const cappedLinks = sortedLinks.slice(0, 200);

  const watchLinksBefore = links.filter(l => l.href && l.href.includes("/watch")).length;
  const watchLinksAfter = cappedLinks.filter(l => l.href && l.href.includes("/watch")).length;

  console.log("[OBSERVATION PIPELINE DIAGNOSTIC]");
  console.log(JSON.stringify({
    url,
    totalLinks: links.length,
    returnedLinks: cappedLinks.length,
    totalButtons: buttons.length,
    returnedButtons: cappedButtons.length,
    totalInputs: inputs.length,
    returnedInputs: cappedInputs.length,
    watchLinksBeforeSlicing: watchLinksBefore,
    watchLinksAfterSlicing: watchLinksAfter
  }, null, 2));

  const tabs = await listTabs().catch(() => []);
  const activeTab = tabs.find(t => t.active) || null;
  const classification = classifyPage(url, title, { inputs, buttons, links });
  const pageType = classification.pageType;
  const site = classification.site;
  const environment = classification.environment || "generic";
  const genericPageType = classification.pageType;

  console.log("[PAGE CLASSIFIER DIAGNOSTIC]");
  console.log(JSON.stringify({
    url,
    pageType,
    genericPageType,
    environment,
    site,
    classificationCapabilities: classification.capabilities
  }, null, 2));

  console.log("PAGE TYPE:", pageType, "SITE:", site, "ENVIRONMENT:", environment, "GENERIC TYPE:", genericPageType);
  console.log(
    "INPUTS:",
    inputs.length,
    "BUTTONS:",
    buttons.length,
    "LINKS:",
    links.length
  );
  console.log(
    "SEARCH INPUTS (UNSLICED):",
    inputs.filter(x => x.purpose === "search_input")
  );
  console.log(
    "SEARCH BUTTONS (UNSLICED):",
    buttons.filter(x => x.purpose === "search_button")
  );
  console.log(
    "SEARCH LAUNCHERS (UNSLICED):",
    [...inputs, ...buttons, ...links].filter(x => x.purpose === "search_launcher")
  );
  console.log(
    "SEARCH INPUTS (SLICED):",
    cappedInputs.filter(x => x.purpose === "search_input")
  );

  updateBrowserContext({
    title,
    url,
    pageType,
    site,
    environment,
    genericPageType,
    buttons: cappedButtons,
    inputs: cappedInputs,
    links: cappedLinks,
    forms,
    text,
    tabs,
    activeTab
  });
  
  const quality = scoreObservation(text, cappedButtons, cappedInputs, cappedLinks);

  return {
    success: true,
    title,
    url,
    pageType,
    site,
    environment,
    genericPageType,
    buttons: cappedButtons,
    inputs: cappedInputs,
    links: cappedLinks,
    forms,
    text,
    tabs,
    activeTab,
    observationQuality: quality
  };
}
