const SKILLS = [
  "navigate", "search", "select", "authenticate", "fill form", "recover", "extract", "compare", "continue workflow", "multi-tab", "research"
];

const TOPICS = [
  "react", "vue", "angular", "node", "python", "javascript", "golang", "rust",
  "lofi", "jazz", "classical music", "coding music", "rain sounds", "nature sounds",
  "iphone 15", "macbook air", "wireless headphones", "mechanical keyboard", "gaming mouse",
  "artificial intelligence", "machine learning", "quantum computing", "blockchain", "cybersecurity",
  "world war 2", "climate change", "solar system", "mount everest", "great barrier reef"
];

const BASE_SCENARIOS = [
  {
    id: "nav_base_1",
    skill: "navigate",
    goal: "navigate to the main portal",
    expectedState: "home"
  },
  {
    id: "search_base_1",
    skill: "search",
    goal: "search the portal for active content",
    expectedState: "results"
  },
  {
    id: "recovery_base_1",
    skill: "recover",
    goal: "navigate to portal and dismiss popup modal",
    expectedState: "home"
  },
  {
    id: "login_base_1",
    skill: "authenticate",
    goal: "authenticate and login to portal",
    expectedState: "logged_in"
  }
];

function generateScenarios() {
  const list = [...BASE_SCENARIOS];
  let idCounter = 1;

  for (const topic of TOPICS) {
    list.push({
      id: `media_gen_${idCounter++}`,
      skill: "consume_media",
      goal: `play latest media content of ${topic}`,
      expectedState: "video_playing"
    });
    
    list.push({
      id: `extract_gen_${idCounter++}`,
      skill: "extract",
      goal: `search portal for ${topic} and extract details`,
      expectedState: "information_extracted"
    });

    list.push({
      id: `compare_gen_${idCounter++}`,
      skill: "compare",
      goal: `compare search results for ${topic} and get prices`,
      expectedState: "information_extracted"
    });

    list.push({
      id: `research_gen_${idCounter++}`,
      skill: "research",
      goal: `research portal for ${topic} and extract summary information`,
      expectedState: "information_extracted"
    });
  }

  return list;
}

export const SCENARIOS = generateScenarios();
console.log(`[SCENARIOS] Programmatically generated ${SCENARIOS.length} skill-based evaluation tasks.`);
