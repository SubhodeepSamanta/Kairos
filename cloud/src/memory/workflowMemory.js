export class WorkflowMemory {
  constructor() {
    this.currentWebsite = "";
    this.activeTab = 0;
    this.openWorkflows = [];
    this.previousSearches = [];
    this.previousActions = [];
    this.unfinishedForms = {};
    
    this.currentObjective = "";
    this.currentSubObjective = "";
    this.openTabs = {};
    this.visitedPages = [];
    this.completedActions = [];
    this.failedActions = [];
    this.userResponses = [];
    this.outstandingQuestions = [];
    this.partialForms = {};
    this.authenticationState = { authenticated: false, domain: null };
    this.currentWorkflowStage = "idle";
  }

  update(browserState, pageUnderstanding, lastAction) {
    if (!browserState) return;

    this.currentWebsite = browserState.url || "";
    this.activeTab = browserState.activeTab || 0;

    const resolvedState = pageUnderstanding?.resolvedState;
    if (resolvedState) {
      const stageMap = {
        "blank": "initial",
        "home": "navigation",
        "results": "search_results",
        "content": "content_viewing",
        "login": "authentication",
        "settings": "configuration"
      };
      this.currentWorkflowStage = stageMap[resolvedState.currentState] || resolvedState.semanticState || "active";
    }

    if (this.currentWebsite && !this.visitedPages.includes(this.currentWebsite) && this.currentWebsite !== "about:blank") {
      this.visitedPages.push(this.currentWebsite);
    }

    const tabs = browserState.tabs || [];
    tabs.forEach(tab => {
      const existing = this.openTabs[tab.id] || {};
      this.openTabs[tab.id] = {
        url: tab.url,
        title: tab.title,
        active: tab.active,
        purpose: existing.purpose || (tab.active && pageUnderstanding ? pageUnderstanding.pagePurpose : "generic"),
        workflowStage: existing.workflowStage || this.currentWorkflowStage,
        originTabId: existing.originTabId || null,
        relationship: existing.relationship || null
      };
      if (tab.active) {
        this.activeTab = tab.id;
      }
    });

    if (pageUnderstanding) {
      if (pageUnderstanding.workflows) {
        this.openWorkflows = [...new Set([...this.openWorkflows, ...pageUnderstanding.workflows])];
      }
      
      if (pageUnderstanding.pagePurpose === "form" || pageUnderstanding.pagePurpose === "login flow") {
        const inputs = browserState.inputs || [];
        inputs.forEach(input => {
          if (input.value !== undefined && input.value !== "") {
            this.unfinishedForms[input.id] = input.value;
            this.partialForms[input.id] = input.value;
          }
        });
      }
    }

    if (lastAction) {
      this.previousActions.push({
        action: lastAction,
        timestamp: Date.now()
      });
      if (this.previousActions.length > 50) {
        this.previousActions.shift();
      }

      if (lastAction.type === "new_tab") {
        const currentTabIds = Object.keys(this.openTabs).map(Number);
        const nextTabId = currentTabIds.length > 0 ? Math.max(...currentTabIds) + 1 : 1;
        this.openTabs[nextTabId] = {
          url: "about:blank",
          title: "New Tab",
          purpose: "comparison",
          workflowStage: this.currentWorkflowStage,
          originTabId: this.activeTab,
          relationship: "child_comparison"
        };
      }

      if (lastAction.type === "type" || lastAction.type === "search") {
        const text = lastAction.params?.text;
        if (text && !this.previousSearches.includes(text)) {
          this.previousSearches.push(text);
          if (this.previousSearches.length > 10) {
            this.previousSearches.shift();
          }
        }
      }
    }
  }

  handleWorkflowIntents(goalText) {
    const text = goalText.toLowerCase().trim();
    
    if (text === "continue" || text === "resume") {
      return { action: "continue", context: this };
    }
    if (text === "close that tab" || text === "close tab") {
      return { action: "close_tab", targetTabId: this.activeTab, context: this };
    }
    if (text.includes("go back to the") || text.includes("go back to")) {
      const targetUrl = [...this.visitedPages].reverse().find(url => {
        return text.includes("search") && (url.includes("search") || url.includes("results"));
      });
      if (targetUrl) {
        return { action: "navigate", url: targetUrl, context: this };
      }
      return { action: "back", context: this };
    }
    
    return null;
  }
}
