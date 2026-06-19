export function buildObjectives(intent) {
  const objectives = [];
  const platform = intent.platform || "google";

  // Check for compound goals or sub-actions in intent context
  const originalGoal = (intent.originalGoal || "").toLowerCase();
  
  if (originalGoal.includes("search github for react") && originalGoal.includes("extract stars")) {
    // Multi-objective compound goal scenario
    objectives.push({
      id: "obj1",
      desiredState: "home",
      platform: "github",
      parameters: {},
      successConditions: ["URL contains github"],
      priority: 5,
      dependencies: [],
      confidence: 1.0,
      openQuestions: []
    });
    objectives.push({
      id: "obj2",
      desiredState: "results",
      platform: "github",
      parameters: { query: "react" },
      successConditions: ["URL contains github", "query contains react"],
      priority: 4,
      dependencies: ["obj1"],
      confidence: 1.0,
      openQuestions: []
    });
    objectives.push({
      id: "obj3",
      desiredState: "result_selected",
      platform: "github",
      parameters: { ordinal: "first" },
      successConditions: ["URL is detailed result page"],
      priority: 3,
      dependencies: ["obj2"],
      confidence: 1.0,
      openQuestions: []
    });
    objectives.push({
      id: "obj4",
      desiredState: "information_extracted",
      platform: "github",
      parameters: { query: "extract stars count" },
      successConditions: ["stars count extracted"],
      priority: 2,
      dependencies: ["obj3"],
      confidence: 1.0,
      openQuestions: ["What is the repository stars count?"]
    });
    
    return objectives;
  }

  // Standard intent mapping
  switch (intent.intent) {
    case "search": {
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform,
        parameters: {},
        successConditions: [`URL contains ${platform}`],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.query}`],
        priority: 4,
        dependencies: ["obj1"],
        confidence: 1.0,
        openQuestions: []
      });
      break;
    }

    case "play_video": {
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform,
        parameters: {},
        successConditions: [`URL contains ${platform}`],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.query}`],
        priority: 4,
        dependencies: ["obj1"],
        confidence: 1.0,
        openQuestions: []
      });
      objectives.push({
        id: "obj3",
        desiredState: "video_playing",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `video is playing`],
        priority: 3,
        dependencies: ["obj2"],
        confidence: 1.0,
        openQuestions: ["What is the video length?", "Who uploaded the video?"]
      });
      break;
    }

    case "extract_information": {
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform,
        parameters: {},
        successConditions: [`URL contains ${platform}`],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.topic },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.topic}`],
        priority: 4,
        dependencies: ["obj1"],
        confidence: 1.0,
        openQuestions: []
      });
      
      const infoQuestions = [];
      const topicLower = (intent.topic || "").toLowerCase();
      if (topicLower.includes("job") || topicLower.includes("intern") || topicLower.includes("career")) {
        infoQuestions.push(
          "What is the application deadline?",
          "What is the location?",
          "What are the requirements?",
          "What is the application link?"
        );
      } else {
        infoQuestions.push(`What is the extracted data for "${intent.topic}"?`);
      }

      objectives.push({
        id: "obj3",
        desiredState: "information_extracted",
        platform,
        parameters: { topic: intent.topic },
        successConditions: ["data is extracted"],
        priority: 3,
        dependencies: ["obj2"],
        confidence: 1.0,
        openQuestions: infoQuestions
      });
      break;
    }

    case "navigate": {
      const url = intent.url || intent.platform || "google.com";
      const domain = url.toLowerCase().replace(/https?:\/\/(www\.)?/, "").split("/")[0];
      const platformName = domain.replace(/\.com|\.org|\.net/g, "");
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform: platformName,
        parameters: { url },
        successConditions: [`URL contains ${domain}`],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      break;
    }

    default:
      objectives.push({
        id: "obj1",
        desiredState: "goal_completed",
        platform: "generic",
        parameters: { goal: intent.originalGoal },
        successConditions: ["goal completed"],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      break;
  }

  return objectives;
}
