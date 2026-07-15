import { askLLM } from "../llm/provider.js";
import { getSummary, setSummary, countTurns, loadTurnsBefore } from "./store.js";

const SUMMARIZE_EVERY = 10;
const LIVE_WINDOW = 14;
const MAX_SUMMARY_CHARS = 700;

const SYSTEM = `You keep a running memory of a friendship. Compress what you're given into ONE short paragraph a friend would actually remember.

Keep: who they are, what they're working on, ongoing struggles, preferences, promises either of you made, running jokes, anything you'd feel rude forgetting.
Drop: pleasantries, one-off task chatter, anything already obvious.
Never invent. If there's nothing worth keeping, reply with exactly: NOTHING

Write it as notes to yourself, third person ("they"), under 90 words. No preamble.`;

export async function maybeSummarize(chatId, budget = null) {
  const total = await countTurns(chatId);
  const existing = await getSummary(chatId);

  const targetCovered = Math.max(0, total - LIVE_WINDOW);
  if (targetCovered - existing.coveredTurns < SUMMARIZE_EVERY) return existing.text;

  const older = await loadTurnsBefore(chatId, total);
  if (!older.length) return existing.text;

  const covered = existing.coveredTurns + older.length;

  const transcript = older.map(t => `${t.role === "user" ? "them" : "you"}: ${t.text}`).join("\n");
  const userPrompt = existing.text
    ? `What you remembered so far:\n${existing.text}\n\nNewer conversation:\n${transcript}\n\nUpdated memory:`
    : `Conversation:\n${transcript}\n\nMemory:`;

  try {
    const raw = await askLLM(SYSTEM, userPrompt.slice(0, 6000), budget);
    const text = String(raw || "").trim();
    if (!text || /^NOTHING$/i.test(text)) {
      await setSummary(chatId, existing.text || "", covered);
      return existing.text;
    }
    const clean = text.slice(0, MAX_SUMMARY_CHARS);
    await setSummary(chatId, clean, covered);
    console.log(`[COMPANION] summary updated for ${chatId} (${covered}/${total} turns folded in)`);
    return clean;
  } catch (err) {
    console.log(`[COMPANION] summary skipped: ${err.message.slice(0, 60)}`);
    return existing.text;
  }
}
