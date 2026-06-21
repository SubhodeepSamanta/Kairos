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
          this.title = "YouTube";
          this.pageType = "youtube_home";
          this.inputs = [{ id: "y1", purpose: "search_input" }];
          this.buttons = [{ id: "y2", purpose: "search_button" }];
          this.links = [{ id: "y3", purpose: "video_link", href: "/watch?v=1" }];
        } else if (lowerUrl.includes("github.com")) {
          this.title = "GitHub";
          this.pageType = "github_home";
          this.inputs = [{ id: "g1", purpose: "search_input" }];
          this.buttons = [{ id: "g2", purpose: "submit_button" }];
          this.links = [{ id: "g3", purpose: "result_link" }];
        } else if (lowerUrl.includes("amazon.com")) {
          this.title = "Amazon";
          this.pageType = "amazon_home";
          this.inputs = [{ id: "a1", purpose: "search_input" }];
          this.buttons = [{ id: "a2", purpose: "search_button" }];
          this.links = [{ id: "a3", purpose: "product_link" }];
        } else {
          this.title = "Google";
          this.pageType = "google_home";
          this.inputs = [{ id: "o1", purpose: "search_input" }];
          this.buttons = [{ id: "o2", purpose: "search_button" }];
          this.links = [{ id: "o3", purpose: "result_link" }];
        }
        this.text = `Welcome to ${this.title}. Find your desired content.`;
      } else if (action.type === "type") {
        const input = this.inputs.find(i => i.id === action.params.element);
        if (input) {
          input.value = action.params.text;
        }
      } else if (action.type === "press_key" && action.params.key === "Enter") {
        const queryVal = this.inputs[0]?.value || "react";
        this.url = `${this.url}/search?q=${encodeURIComponent(queryVal)}`;
        this.pageType = `${this.pageType.split("_")[0]}_results`;
        this.title = `${queryVal} - Search Results`;
        this.text = `Here are the top results for ${queryVal}. Location details and requirements available. July 15 deadline.`;
      } else if (action.type === "click") {
        const link = this.links.find(l => l.id === action.params.element);
        if (link) {
          if (link.purpose === "video_link" || (link.href && link.href.includes("/watch"))) {
            this.url = `https://youtube.com/watch?v=1`;
            this.pageType = "youtube_video_playing";
            this.title = "Lofi Hip Hop Radio - Radio";
            this.text = "Video length: 2:30. Uploaded by Lofi Records.";
          } else {
            this.url = `${this.url}/details`;
            this.pageType = `${this.pageType.split("_")[0]}_details`;
            this.title = "Detail View";
            this.text = "Specific details: deadline is July 15. Location: India. Requirements: JS knowledge.";
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
  const scen = SCENARIOS.find(s => s.id === "youtube_gen_1");
  const sim = new BrowserSimulator();
  console.log(`\n--- Running Scenario: ${scen.id} ("${scen.goal}") ---`);
  sim.reset();

  const goal = {
    id: scen.id,
    objective: scen.goal,
    world: {
      history: [],
      completedTasks: [],
      failedTasks: [],
      findings: [],
      entities: [],
      failedActionHistory: []
    }
  };

  const result = await runAgent({ goal, executePlan: (plan) => sim.execute(plan) });
  console.log("RESULT SUCCESS:", result.success);
  console.log("FINAL STATE:", sim.getCurrentState());
}
run();
