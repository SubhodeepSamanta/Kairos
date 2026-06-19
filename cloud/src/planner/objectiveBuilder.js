export function buildObjectives(intent) {
  const objectives = [];
  const platform = intent.platform || "google";

  switch (intent.intent) {
    case "search": {
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform,
        parameters: {},
        successConditions: [`URL contains ${platform}`],
        openQuestions: []
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.query}`],
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
        openQuestions: []
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.query}`],
        openQuestions: []
      });
      objectives.push({
        id: "obj3",
        desiredState: "video_playing",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `video is playing`],
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
        openQuestions: []
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.topic },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.topic}`],
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
        openQuestions: []
      });
      break;
  }

  return objectives;
}
