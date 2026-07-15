const CRISIS_PATTERNS = [
  /\bkill (?:myself|me)\b/i,
  /\bkilling myself\b/i,
  /\b(?:want|going|plan|about) to die\b/i,
  /\bend (?:my life|it all)\b/i,
  /\bending my life\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bnot worth living\b/i,
  /\bno reason to live\b/i,
  /\bbetter off (?:dead|without me)\b/i,
  /\b(?:hurt|harm|cut|hurting|harming|cutting|burning|starving)\s+myself\b/i,
  /\bself[- ]harm/i,
  /\boverdose\b/i,
  /\bdon'?t want to (?:be here|live|wake up)\b/i,
  /\bdisappear forever\b/i
];

const NEGATION = /\b(?:movie|film|game|song|lyrics|book|character|joke|kidding|meme|assignment|essay|homework)\b/i;

export function detectCrisis(text) {
  const message = String(text || "");
  if (!message.trim()) return false;
  if (!CRISIS_PATTERNS.some(p => p.test(message))) return false;
  if (NEGATION.test(message)) return false;
  return true;
}

export const CRISIS_REPLY = `I'm really glad you told me, and I want to say clearly: I'm not going to brush past that.

I'm an AI — I can't be what you need right now, but people can, and they will actually want to hear from you:

• **Tele-MANAS (India, 24/7): 14416** or 1-800-891-4416
• **AASRA: +91-9820466726** (24/7)
• If you're not in India: your local emergency number, or findahelpline.com
• If you're in immediate danger, please call emergency services now

If there's someone you trust — a friend, family, anyone — reaching out to them tonight matters more than anything on your screen.

I'm still here. We can just talk, if that helps.`;

export function shouldStayQuiet(text) {
  const message = String(text || "").toLowerCase();
  const venting = /\b(?:i'?m|im|feeling|feel|been)\s+(?:\w+\s+){0,2}(?:tired|exhausted|done|drained|sad|low|lonely|anxious|stressed|overwhelmed|burnt? ?out|burned out|depressed|miserable|hopeless|numb|empty)\b/;
  const asking = /\b(?:open|play|search|find|go to|show|get|start|launch|close|switch|log ?in|star|comment|watch|read)\b/;
  return venting.test(message) && !asking.test(message);
}
