import { SCENARIOS } from "./scenarios.js";
import { runAgent } from "../agent/index.js";

class BrowserSimulator {
  constructor() {
    this.reset();
  }

  reset() {
    this.url = "about:blank";
    this.title = "";
    this.text = "";
    this.pageType = "blank";
    this.inputs = [];
    this.buttons = [];
    this.links = [];
    this.tabs = [{ url: "about:blank", title: "Blank Tab" }];
    this.activeTab = 0;
  }

  getCurrentState() {
    return {
      url: this.url,
      title: this.title,
      text: this.text,
      pageType: this.pageType,
      inputs: this.inputs,
      buttons: this.buttons,
      links: this.links,
      tabs: this.tabs,
      activeTab: this.activeTab
    };
  }

  execute(plan) {
    const observations = [];
    for (const action of plan.actions) {
      console.log(`[SIMULATOR] Action received: ${action.type}`, action.params);
      
      if (action.type === "navigate") {
        this.url = action.params.url;
        const lowerUrl = this.url.toLowerCase();
        
        if (lowerUrl.includes("youtube.com")) {
          this.title = "Media Portal";
          this.pageType = "media_home";
          this.inputs = [{ id: "m1", purpose: "search_input", semanticType: "search_input" }];
          this.buttons = [{ id: "m2", purpose: "search_button" }];
          this.links = [];
        } else if (lowerUrl.includes("github.com") || lowerUrl.includes("portal")) {
          this.title = "Resource Portal";
          this.pageType = "resource_home";
          this.inputs = [{ id: "r1", purpose: "search_input", semanticType: "search_input" }];
          this.buttons = [{ id: "r2", purpose: "submit_button" }];
          this.links = [];
        } else if (lowerUrl.includes("broken")) {
          this.title = "Overlay Portal";
          this.pageType = "modal_overlay";
          this.buttons = [{ id: "b1", text: "Dismiss popup", purpose: "close_button" }];
          this.text = "This page contains privacy cookie banner. Close to view.";
        } else {
          this.title = "Standard Search Portal";
          this.pageType = "search_home";
          this.inputs = [{ id: "s1", purpose: "search_input", semanticType: "search_input" }];
          this.buttons = [{ id: "s2", purpose: "search_button" }];
          this.links = [];
        }
        this.text = `Welcome to ${this.title}. Find your desired content.`;

        if (lowerUrl.includes("login") || lowerUrl.includes("auth")) {
          this.pageType = "login_page";
          this.inputs = [
            { id: "u1", type: "text", placeholder: "Username", purpose: "credential_input" },
            { id: "p1", type: "password", placeholder: "Password", purpose: "credential_input" }
          ];
          this.buttons = [{ id: "l1", text: "Sign In", purpose: "login_button" }];
          this.text = "Authentication Portal. Please enter credentials.";
        }

      } else if (action.type === "type") {
        const input = this.inputs.find(i => i.id === action.params.element);
        if (input) {
          input.value = action.params.text;
        }
      } else if (action.type === "press_key" && action.params.key === "Enter") {
        const queryVal = this.inputs[0]?.value || "react";
        this.url = `${this.url}/search?q=${encodeURIComponent(queryVal)}`;
        this.pageType = "search_results";
        this.title = `${queryVal} - Search Results`;
        this.text = `Here are the top results for ${queryVal}. Location details and requirements available. July 15 deadline. Price is $120. Stars count: 45k.`;
        
        if (this.url.includes("youtube")) {
          this.links = [{ id: "v1", purpose: "video_link", semanticType: "content_item", href: "/watch?v=1" }];
        } else {
          this.links = [{ id: "r3", purpose: "result_link", semanticType: "selection_candidate" }];
        }
      } else if (action.type === "click") {
        if (action.params.element === "b1") {
          this.pageType = "search_home";
          this.title = "Overlay Portal Home";
          this.text = "Content loaded successfully.";
          this.inputs = [{ id: "s1", purpose: "search_input", semanticType: "search_input" }];
        } else {
          const link = this.links.find(l => l.id === action.params.element);
          const button = this.buttons.find(b => b.id === action.params.element);
          
          if (link) {
            if (link.purpose === "video_link" || (link.href && link.href.includes("/watch"))) {
              this.url = `https://youtube.com/watch?v=1`;
              this.pageType = "video_playing";
              this.title = "Lofi Hip Hop Radio - Radio";
              this.text = "Video length: 2:30. Uploaded by Lofi Records.";
            } else {
              this.url = `${this.url}/details`;
              this.pageType = "information_extracted";
              this.title = "Detail View";
              this.text = "Specific details: deadline is July 15. Location: India. Requirements: JS knowledge. Price is $120. Stars: 45k.";
            }
          } else if (button && button.id === "l1") {
            this.pageType = "logged_in";
            this.title = "User Dashboard";
            this.text = "Welcome user! You are successfully authenticated.";
          }
        }
      } else if (action.type === "extract_data") {
        this.text += "\n[DATA EXTRACTED SUCCESS]";
      }

      observations.push({
        success: true,
        url: this.url,
        title: this.title,
        pageState: this.getCurrentState()
      });
    }

    return { success: true, observations };
  }
}

async function run() {
  let scenarioId = null;
  const args = process.argv;
  const idx = args.indexOf("--scenario");
  if (idx !== -1 && args[idx + 1]) {
    scenarioId = args[idx + 1];
  }

  let scen = SCENARIOS.find(s => s.id === scenarioId);
  if (!scen) {
    scen = SCENARIOS[0];
    console.log(`[SCRATCH] Scenario '${scenarioId || ""}' not specified/found. Defaulting to '${scen.id}'`);
  }

  const sim = new BrowserSimulator();
  console.log(`\n--- Running Scenario: ${scen.id} ("${scen.goal}") ---`);
  sim.reset();

  const goal = {
    id: scen.id,
    objective: scen.goal,
    world: {
      findings: [],
      history: [],
      failedActionHistory: [],
      actionHistory: [],
      entities: [],
      tabs: [],
      completedTasks: [],
      failedTasks: [],
      lastAction: null,
      lastOutcome: null,
      lastUrl: null,
      lastTitle: null,
      progressIndicators: { totalActions: 0, unchangedPagesCount: 0 }
    }
  };

  const result = await runAgent({ goal, executePlan: (plan) => sim.execute(plan) });

  console.log(`\n=========================================`);
  console.log(`             SCENARIO RESULT             `);
  console.log(`=========================================`);
  console.log(`Success:                 ${result.success}`);
  console.log(`Total Actions:           ${goal.metrics?.totalActions || 0}`);
  console.log(`Final Page Type:         ${sim.pageType}`);
  console.log(`Final Sub-objective:     ${goal.workflowMemory?.currentSubObjective || "None"}`);
  console.log(`=========================================\n`);
}

run();
