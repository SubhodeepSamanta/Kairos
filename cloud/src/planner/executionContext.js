import { askLLM } from "../llm/provider.js";

const MAX_FACTS = 100;
const MAX_ENTITIES = 100;
const MAX_PAGES = 50;

export function createExecutionContext(goal) {
  return {
    goal: goal.objective,
    currentObjective: null,
    worldFacts: [], // Semantic triples: { subject, relation, object, confidence, source, timestamp }
    discoveredEntities: [],
    visitedPages: [],
    openQuestions: [],
    completedQuestions: [],
    executionSummary: null
  };
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return text;
  return text.slice(start, end + 1);
}

export async function extractFactsAndEntities(observation, context) {
  const pageText = observation?.pageState?.text || observation?.text || "";
  const pageUrl = observation?.pageState?.url || observation?.url || "";
  if (!pageText && !pageUrl) {
    return { facts: [], entities: [], resolvedQuestions: [] };
  }

  const systemPrompt = `You are a World Model extraction assistant.
Analyze the page content and URL to:
1. Extract semantic triples showing relationships (subject -> relation -> object) (e.g. Google SWE Intern -> has_deadline -> July 15, or SWE Intern -> has_location -> India).
2. Track entities (e.g. company, person, job, website, product, etc.).
3. Answer any relevant open questions from the list provided.

Return ONLY a JSON object in this format:
{
  "facts": [
    { "subject": "string", "relation": "string", "object": "string", "confidence": 0.0-1.0, "source": "string" }
  ],
  "entities": [
    { "type": "company|person|job|product|website", "name": "string", "attributes": {} }
  ],
  "resolvedQuestions": [
    { "question": "exact question text from input list", "answer": "resolved answer" }
  ]
}
Do not include markdown code block wrapper or any other text.`;

  const userPrompt = `Goal: "${context.goal}"
Open Questions: ${JSON.stringify(context.openQuestions)}
Current URL: "${pageUrl}"
Page Content (truncated):
${pageText.slice(0, 4000)}`;

  try {
    const response = await askLLM(systemPrompt, userPrompt);
    const cleaned = extractJson(response);
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[executionContext] Extraction failed:", err);
    return { facts: [], entities: [], resolvedQuestions: [] };
  }
}

export async function updateExecutionContext(context, observation, resolvedState) {
  if (!observation) return;
  
  const pageUrl = observation.pageState?.url || observation.url;
  const pageTitle = observation.pageState?.title || observation.title;
  
  if (pageUrl && !context.visitedPages.some(p => p.url === pageUrl)) {
    context.visitedPages.push({
      url: pageUrl,
      title: pageTitle || "",
      timestamp: new Date().toISOString()
    });
    
    // Eviction for pages
    if (context.visitedPages.length > MAX_PAGES) {
      context.visitedPages = context.visitedPages.slice(-MAX_PAGES);
    }
  }

  // Perform LLM extraction
  const extracted = await extractFactsAndEntities(observation, context);

  // Merge facts as triples with confidence check
  if (extracted.facts && Array.isArray(extracted.facts)) {
    for (const fact of extracted.facts) {
      if (fact.confidence > 0.75 && fact.source && fact.subject && fact.relation && fact.object) {
        const isDuplicate = context.worldFacts.some(f => 
          f.subject.toLowerCase() === fact.subject.toLowerCase() && 
          f.relation.toLowerCase() === fact.relation.toLowerCase() && 
          f.object.toLowerCase() === fact.object.toLowerCase()
        );
        if (!isDuplicate) {
          context.worldFacts.push({
            ...fact,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    // Eviction for facts
    if (context.worldFacts.length > MAX_FACTS) {
      context.worldFacts = context.worldFacts.slice(-MAX_FACTS);
    }
  }

  // Merge entities
  if (extracted.entities && Array.isArray(extracted.entities)) {
    for (const ent of extracted.entities) {
      if (!context.discoveredEntities.some(e => e.name === ent.name && e.type === ent.type)) {
        context.discoveredEntities.push({
          ...ent,
          timestamp: new Date().toISOString()
        });
      }
    }
    // Eviction for entities
    if (context.discoveredEntities.length > MAX_ENTITIES) {
      context.discoveredEntities = context.discoveredEntities.slice(-MAX_ENTITIES);
    }
  }

  // Resolve open questions
  if (extracted.resolvedQuestions && Array.isArray(extracted.resolvedQuestions)) {
    for (const resQ of extracted.resolvedQuestions) {
      const openIdx = context.openQuestions.indexOf(resQ.question);
      if (openIdx !== -1) {
        context.openQuestions.splice(openIdx, 1);
        context.completedQuestions.push({
          question: resQ.question,
          answer: resQ.answer,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

export function generateExecutionSummary(context) {
  context.executionSummary = {
    objectivesCompleted: context.completedQuestions.length,
    factsCollected: context.worldFacts.length,
    entitiesDiscovered: context.discoveredEntities.length,
    pagesVisited: context.visitedPages.length,
    unresolvedQuestions: context.openQuestions
  };
  return context.executionSummary;
}
