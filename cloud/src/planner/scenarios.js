const TOPICS = [
  "react", "vue", "angular", "node", "python", "javascript", "golang", "rust",
  "lofi", "jazz", "classical music", "coding music", "rain sounds", "nature sounds",
  "iphone 15", "macbook air", "wireless headphones", "mechanical keyboard", "gaming mouse",
  "artificial intelligence", "machine learning", "quantum computing", "blockchain", "cybersecurity",
  "world war 2", "climate change", "solar system", "mount everest", "great barrier reef"
];

const BASE_SCENARIOS = [
  {
    id: "youtube_base_1",
    goal: "open youtube",
    platform: "youtube",
    expectedState: "home"
  },
  {
    id: "github_base_1",
    goal: "open github and search for react",
    platform: "github",
    expectedState: "results"
  },
  {
    id: "recovery_base_1",
    goal: "navigate to broken site and dismiss popup",
    platform: "generic",
    expectedState: "home"
  },
  {
    id: "login_base_1",
    goal: "login to github",
    platform: "github",
    expectedState: "logged_in"
  }
];

function generateScenarios() {
  const list = [...BASE_SCENARIOS];
  let idCounter = 1;

  for (const topic of TOPICS) {
    // 1. YouTube Scenarios
    list.push({
      id: `youtube_gen_${idCounter++}`,
      goal: `play first video of ${topic} on youtube`,
      platform: "youtube",
      expectedState: "video_playing"
    });
    
    // 2. GitHub Scenarios
    list.push({
      id: `github_gen_${idCounter++}`,
      goal: `search github for ${topic} and extract star count`,
      platform: "github",
      expectedState: "information_extracted"
    });

    // 3. Amazon Scenarios
    list.push({
      id: `amazon_gen_${idCounter++}`,
      goal: `search amazon for ${topic} and get price`,
      platform: "amazon",
      expectedState: "information_extracted"
    });

    // 4. Wikipedia Scenarios
    list.push({
      id: `wikipedia_gen_${idCounter++}`,
      goal: `search wikipedia for ${topic} and get summary`,
      platform: "wikipedia",
      expectedState: "information_extracted"
    });
  }

  return list;
}

export const SCENARIOS = generateScenarios();
console.log(`[SCENARIOS] Programmatically generated ${SCENARIOS.length} evaluation tasks.`);
