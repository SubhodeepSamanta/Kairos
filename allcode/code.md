
## File List

- [client/src/automation/browser/actions/snapshot.js](file:///c:/Users/USER/Desktop/Kairos/client/src/automation/browser/actions/snapshot.js)
- [client/src/automation/browser/actions/click.js](file:///c:/Users/USER/Desktop/Kairos/client/src/automation/browser/actions/click.js)
- [cloud/src/agent/worldModel.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/agent/worldModel.js)

## Contents

### client/src/automation/browser/actions/snapshot.js

```javascript
import {
  getCurrentPage,
  isBrowserOpen
} from "../browser.js";

export async function createSnapshot() {

  if (!isBrowserOpen()) {

    return {
      url: null,
      title: null
    };
  }

  const page =
    getCurrentPage();

  try {
    const context = page.context();
    return {
      url: page.url(),
      title: await page.title(),
      tabCount: context.pages().length
    };

  } catch {

    return {
      url: null,
      title: null,
      tabCount: 0
    };
  }
}
```

### client/src/automation/browser/actions/click.js

```javascript
import { getPage } from "../browser.js";
import {
  getElement
} from "../elements/registry.js";

export async function clickText(
  text,
  element
) {

  const page =
    await getPage();

  const context = page.context();
  const pagesBefore = context.pages().length;

  if (element) {

    const locator =
      getElement(
        element
      );

    if (!locator) {

      return {
        success: false,
        reason:
          `Unknown element ${element}`
      };
    }

    await locator.click();

    await Promise.race([
      page.waitForNavigation({
        timeout: 5000
      }),
      page.waitForLoadState(
        "networkidle",
        {
          timeout: 5000
        }
      )
    ]).catch(() => {});

    await page
      .waitForLoadState(
        "domcontentloaded",
        {
          timeout: 3000
        }
      )
      .catch(() => {});

    await page.waitForTimeout(1000);
    const pagesAfter = context.pages().length;

    return {
      success: true,
      clicked:
        `element ${element}`,
      newTabOpened: pagesAfter > pagesBefore
    };
  }

  const elements =
    page.locator(
`
button,
a,
input[type='submit'],
input[type='button'],
[role='button'],
[aria-label]
`
    );

  const count =
    await elements.count();

  let target =
    null;

  for (
    let i = 0;
    i < count;
    i++
  ) {

    const candidate =
      elements.nth(i);

    const visible =
      await candidate
        .isVisible()
        .catch(() => false);

    if (!visible) {
      continue;
    }

    const textContent =
      (
        await candidate
          .innerText()
          .catch(() => "") ||

        await candidate
          .getAttribute(
            "aria-label"
          )
          .catch(() => "") ||

        ""
      )
      .trim()
      .toLowerCase();

    const targetText =
      text.toLowerCase();

    if (
      textContent ===
        targetText ||

      textContent.startsWith(
        targetText + " "
      )
    ) {

      target =
        candidate;

      break;
    }
  }

  if (!target) {

    return {
      success: false,
      reason:
        `Could not find ${text}`
    };
  }

  console.log(
    "CLICKING:",
    text
  );

  await target.click();

  await Promise.race([
    page.waitForNavigation({
      timeout: 5000
    }),
    page.waitForLoadState(
      "networkidle",
      {
        timeout: 5000
      }
    )
  ]).catch(() => {});

  await page
    .waitForLoadState(
      "domcontentloaded",
      {
        timeout: 3000
      }
    )
    .catch(() => {});

  await page.waitForTimeout(1000);
  const pagesAfter = context.pages().length;

  return {
    success: true,
    clicked: text,
    newTabOpened: pagesAfter > pagesBefore
  };
}
```

### cloud/src/agent/worldModel.js

```javascript

export function updateWorldModel(
  goal,
  observation
) {

  const world =
    goal.world;

  if (!world) return;

  world.history.push({
    timestamp:
      Date.now(),
    observation: {
      success:
        observation?.success,
      url:
        observation?.url,
      title:
        observation?.title,
      action:
        observation?.action,
      pageState:
        observation?.pageState
          ? {
              url:
                observation.pageState.url,
              title:
                observation.pageState.title
            }
          : null,
      events:
        observation?.events || [],
      reason:
        observation?.reason || null
    }
  });

  if (world.history.length > 50) {
    world.history =
      world.history.slice(-50);
  }

  if (
    observation?.pageState?.url ||
    observation?.url
  ) {
    world.lastUrl =
      observation?.pageState?.url ||
      observation?.url;
  }

  if (
    observation?.pageState?.title ||
    observation?.title
  ) {
    world.lastTitle =
      observation?.pageState?.title ||
      observation?.title;
  }

  // Record action outcomes and failures
  if (observation?.action) {
    world.lastAction = observation.action;
    
    // Page unchanged outcome check
    const historyLen = world.history.length;
    let outcome = "success";
    if (observation.success === false) {
      outcome = observation.reason || "failed";
    } else if (historyLen >= 2) {
      const prevObs = world.history[historyLen - 2]?.observation;
      const prevUrl = prevObs?.url;
      const prevTitle = prevObs?.title;
      const currentUrl = observation.url || observation.pageState?.url;
      const currentTitle = observation.title || observation.pageState?.title;
      
      if (prevUrl === currentUrl && prevTitle === currentTitle) {
        outcome = "page unchanged";
      }
    }
    
    world.lastOutcome = outcome;

    if (outcome !== "success") {
      world.failedActionHistory.push({
        action: observation.action,
        reason: outcome,
        timestamp: Date.now()
      });
      if (world.failedActionHistory.length > 20) {
        world.failedActionHistory = world.failedActionHistory.slice(-20);
      }
    }
  }
}

export function recordCompletedTask(
  goal,
  task
) {

  if (!goal.world) return;

  goal.world.completedTasks.push({
    id: task.id,
    objective: task.objective,
    completedAt: Date.now()
  });
}

export function recordFailedTask(
  goal,
  task,
  reason
) {

  if (!goal.world) return;

  goal.world.failedTasks.push({
    id: task.id,
    objective: task.objective,
    reason,
    failedAt: Date.now()
  });
}

export function addFinding(
  goal,
  finding
) {

  if (!goal.world) return;

  goal.world.findings.push({
    ...finding,
    discoveredAt: Date.now()
  });
}

export function addEntity(
  goal,
  entity
) {

  if (!goal.world) return;

  goal.world.entities.push({
    ...entity,
    discoveredAt: Date.now()
  });
}

export function getWorldSummary(
  goal
) {

  if (!goal.world) return "";

  const w = goal.world;

  const parts = [];

  if (w.lastUrl) {
    parts.push(
      `Current URL: ${w.lastUrl}`
    );
  }

  if (w.lastTitle) {
    parts.push(
      `Current Title: ${w.lastTitle}`
    );
  }

  if (w.completedTasks.length > 0) {
    parts.push(
      `Completed tasks: ${
        w.completedTasks.map(
          t => `${t.objective}`
        ).join(", ")
      }`
    );
  }

  if (w.failedTasks.length > 0) {
    parts.push(
      `Failed tasks: ${
        w.failedTasks.map(
          t => `${t.objective}: ${t.reason}`
        ).join(", ")
      }`
    );
  }

  if (w.findings.length > 0) {
    parts.push(
      `Findings: ${
        w.findings.map(
          f => JSON.stringify(f)
        ).join(", ")
      }`
    );
  }

  if (w.entities.length > 0) {
    parts.push(
      `Entities: ${
        w.entities.map(
          e => JSON.stringify(e)
        ).join(", ")
      }`
    );
  }

  if (w.lastAction) {
    parts.push(
      `Last Action: ${JSON.stringify(w.lastAction)}`
    );
  }

  if (w.lastOutcome) {
    parts.push(
      `Last Action Outcome: ${w.lastOutcome}`
    );
  }

  if (w.failedActionHistory.length > 0) {
    parts.push(
      `Failed Actions: ${
        w.failedActionHistory.map(
          f => `${f.action.type}(${JSON.stringify(f.action.params)}): ${f.reason}`
        ).join(", ")
      }`
    );
  }

  return parts.join("\n");
}
```

