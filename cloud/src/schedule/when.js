const UNITS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
const RELATIVE = /^(?:in\s+)?(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b/i;
const CLOCK = /^(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
const DAILY = /^(?:every\s*day|daily)\s+(.*)$/i;
const TOMORROW = /^tomorrow\s+(.*)$/i;

function unitMs(word) {
  const first = word[0].toLowerCase();
  return UNITS[first] || null;
}

function nextClock(now, hours, minutes, dayOffset = 0) {
  const at = new Date(now);
  at.setSeconds(0, 0);
  at.setHours(hours, minutes);
  if (dayOffset) at.setDate(at.getDate() + dayOffset);
  else if (at.getTime() <= now) at.setDate(at.getDate() + 1);
  return at.getTime();
}

function parseClock(text, now, dayOffset = 0) {
  const match = CLOCK.exec(text.trim());
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const suffix = (match[3] || "").toLowerCase();
  if (hours > 23 || minutes > 59) return null;
  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;
  if (!suffix && !match[2] && hours <= 12 && hours !== 0) {
    const soon = nextClock(now, hours, minutes, dayOffset);
    return { at: soon, rest: text.slice(match[0].length).trim(), ambiguous: true };
  }
  return { at: nextClock(now, hours, minutes, dayOffset), rest: text.slice(match[0].length).trim() };
}

export function parseWhen(input, now = Date.now()) {
  const text = String(input || "").trim();
  if (!text) return null;

  const daily = DAILY.exec(text);
  if (daily) {
    const clock = parseClock(daily[1], now);
    if (!clock || !clock.rest) return null;
    return { at: clock.at, repeatMs: UNITS.d, goal: clock.rest, describe: `every day` };
  }

  const tomorrow = TOMORROW.exec(text);
  if (tomorrow) {
    const clock = parseClock(tomorrow[1], now, 1);
    if (!clock || !clock.rest) return null;
    return { at: clock.at, repeatMs: null, goal: clock.rest, describe: "tomorrow" };
  }

  const relative = RELATIVE.exec(text);
  if (relative) {
    const ms = unitMs(relative[2]) * Number(relative[1]);
    const rest = text.slice(relative[0].length).replace(/^(?:from now|later)?[,:]?\s*/i, "").trim();
    if (!ms || !rest) return null;
    return { at: now + ms, repeatMs: null, goal: rest, describe: `in ${relative[1]}${relative[2][0].toLowerCase()}` };
  }

  const clock = parseClock(text, now);
  if (clock && clock.rest) {
    return { at: clock.at, repeatMs: null, goal: clock.rest, describe: "at that time" };
  }

  return null;
}

export function describeWhen(at, repeatMs, now = Date.now()) {
  const when = new Date(at);
  const time = when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sameDay = new Date(now).toDateString() === when.toDateString();
  const day = sameDay ? "today" : when.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return repeatMs === UNITS.d ? `every day at ${time}` : `${day} at ${time}`;
}
