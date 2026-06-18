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
        successConditions: [`URL contains ${platform}`]
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.query}`]
      });
      break;
    }

    case "play_video": {
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform,
        parameters: {},
        successConditions: [`URL contains ${platform}`]
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.query}`]
      });
      objectives.push({
        id: "obj3",
        desiredState: "video_playing",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `video is playing`]
      });
      break;
    }

    case "extract_information": {
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform,
        parameters: {},
        successConditions: [`URL contains ${platform}`]
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.topic },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.topic}`]
      });
      objectives.push({
        id: "obj3",
        desiredState: "information_extracted",
        platform,
        parameters: { topic: intent.topic },
        successConditions: ["data is extracted"]
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
        successConditions: [`URL contains ${domain}`]
      });
      break;
    }

    default:
      objectives.push({
        id: "obj1",
        desiredState: "goal_completed",
        platform: "generic",
        parameters: { goal: intent.originalGoal },
        successConditions: ["goal completed"]
      });
      break;
  }

  return objectives;
}
