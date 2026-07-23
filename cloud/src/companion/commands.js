import { listPersonas, getPersona, personaLabel, PERSONAS } from "./personas.js";
import { getPrefs, setPrefs, loadMoods, loadEvents, getSummary, forgetChat } from "./store.js";
import { formatMood } from "./context.js";
import { getAllFacts, forgetFact, memoryBackend } from "../memory/store.js";
import { pendingDbWrites } from "../memory/syncQueue.js";
import { llmStatus } from "../llm/provider.js";
import { runtimeStatus, formatDuration } from "../runtime.js";
import { lastTrace, formatTrace } from "../agent/trace.js";
import { scheduleGoal, cancelScheduled, formatSchedule } from "../schedule/scheduler.js";
import { parseWhen, describeWhen } from "../schedule/when.js";

export const COMMANDS = [
  { name: "/personality", args: "[name]", help: "switch how Kairos talks to you" },
  { name: "/mood", args: "[on|off|clear]", help: "see or control the mood read" },
  { name: "/memory", args: "", help: "what Kairos remembers about you" },
  { name: "/recent", args: "", help: "what you did recently" },
  { name: "/about", args: "", help: "who Kairos thinks you are" },
  { name: "/forget", args: "<key|chat|moods|all>", help: "make Kairos forget something" },
  { name: "/remind", args: "<when> <what>", help: "have Kairos do something later" },
  { name: "/scheduled", args: "", help: "what Kairos is going to do" },
  { name: "/unschedule", args: "<id>", help: "call one of those off" },
  { name: "/status", args: "", help: "is everything actually working" },
  { name: "/last", args: "", help: "step by step, what she just did" },
  { name: "/help", args: "", help: "show commands" }
];

export function commandSuggestions(input) {
  const text = String(input || "").trimStart();
  if (!text.startsWith("/")) return null;

  const [head, ...rest] = text.split(/\s+/);
  const typedArg = rest.join(" ");

  if (head === "/personality" && text.includes(" ")) {
    return {
      kind: "value",
      command: "/personality",
      items: listPersonas()
        .filter(p => p.id.startsWith(typedArg.toLowerCase()) || p.name.toLowerCase().startsWith(typedArg.toLowerCase()))
        .map(p => ({ value: p.id, label: p.label, help: p.blurb }))
    };
  }

  if (head === "/mood" && text.includes(" ")) {
    return {
      kind: "value",
      command: "/mood",
      items: [
        { value: "on", label: "on", help: "let Kairos read your mood" },
        { value: "off", label: "off", help: "stop reading and storing mood" },
        { value: "clear", label: "clear", help: "delete stored mood history" }
      ].filter(i => i.value.startsWith(typedArg.toLowerCase()))
    };
  }

  return {
    kind: "command",
    items: COMMANDS.filter(c => c.name.startsWith(head)).map(c => ({
      value: c.name,
      label: `${c.name}${c.args ? " " + c.args : ""}`,
      help: c.help
    }))
  };
}

export function isCommand(text) {
  return String(text || "").trimStart().startsWith("/");
}

function resolveCommand(typed) {
  if (COMMANDS.some(c => c.name === typed)) return typed;
  const matches = COMMANDS.filter(c => c.name.startsWith(typed));
  return matches.length === 1 ? matches[0].name : typed;
}

export async function runCommand(chatId, text) {
  const [typedHead, ...rest] = String(text).trim().split(/\s+/);
  const arg = rest.join(" ").trim();
  const head = resolveCommand(typedHead);

  switch (head) {
    case "/help":
      return COMMANDS.map(c => `${c.name}${c.args ? " " + c.args : ""} — ${c.help}`).join("\n");

    case "/personality": {
      const prefs = await getPrefs(chatId);
      if (!arg) {
        const lines = listPersonas().map(p => `${p.id === prefs.persona ? "▸" : " "} ${p.label.padEnd(24)} ${p.blurb}`);
        return `personalities:\n${lines.join("\n")}\n\nswitch with /personality <name>`;
      }
      const key = arg.toLowerCase();
      const match = Object.values(PERSONAS).find(p => p.id === key || p.name.toLowerCase() === key);
      if (!match) {
        return `no personality called "${arg}". options: ${listPersonas().map(p => p.label).join(", ")}`;
      }
      await setPrefs(chatId, { persona: match.id });
      const subject = match.pronouns.split("/")[0];
      return `switching to ${match.name} — ${subject} is ${match.blurb}.`;
    }

    case "/mood": {
      const prefs = await getPrefs(chatId);
      if (arg === "off") {
        await setPrefs(chatId, { moodTracking: false });
        return "mood reading off. i won't infer or store how you're feeling.";
      }
      if (arg === "on") {
        await setPrefs(chatId, { moodTracking: true });
        return "mood reading on.";
      }
      if (arg === "clear") {
        await forgetChat(chatId, "moods");
        return "mood history cleared.";
      }
      if (!prefs.moodTracking) return "mood reading is off. turn it on with /mood on";
      const moods = await loadMoods(chatId, 14);
      if (!moods.length) return "no mood read yet.";
      const recent = moods.slice(-8).map(m => `${new Date(m.at).toLocaleDateString()} ${m.label} (${Number(m.confidence).toFixed(1)})${m.why ? ` — ${m.why}` : ""}`);
      return `what i've picked up (last 2 weeks):\n${recent.join("\n")}\n\n/mood off to stop · /mood clear to wipe`;
    }

    case "/memory": {
      const facts = getAllFacts();
      const entries = Object.entries(facts);
      const pending = pendingDbWrites();
      const status = `stored in ${memoryBackend() === "postgres" ? "postgres (survives restarts)" : "a local file"}${pending ? ` · ${pending} write${pending === 1 ? "" : "s"} waiting to re-sync` : ""}`;
      if (!entries.length) return `i don't know anything about you yet.\n${status}`;
      return `what i remember (${status}):\n${entries.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n/forget <key> to remove one`;
    }

    case "/recent": {
      const events = await loadEvents(chatId, 7);
      if (!events.length) return "nothing recorded yet.";
      return `recently:\n${events.slice(-12).map(e => `${new Date(e.at).toLocaleString()} — ${e.summary}${e.success ? "" : " (failed)"}`).join("\n")}`;
    }

    case "/about": {
      const [prefs, summary, events] = await Promise.all([
        getPrefs(chatId),
        getSummary(chatId),
        loadEvents(chatId, 7)
      ]);
      const persona = getPersona(prefs.persona);
      const factCount = Object.keys(getAllFacts()).length;
      const lines = [`you're talking to ${personaLabel(persona)} — ${persona.blurb}.`];
      lines.push(`i'm holding ${factCount} fact${factCount === 1 ? "" : "s"} about you.`);
      if (events.length) {
        const worked = events.filter(e => e.success).length;
        lines.push(`${events.length} thing${events.length === 1 ? "" : "s"} this week (${worked} worked out).`);
      }
      if (prefs.moodTracking) {
        const moods = await loadMoods(chatId, 14);
        if (moods.length) lines.push(`mood read: ${formatMood(moods)}`);
      }
      lines.push(summary.text ? `\nwhat i've picked up:\n${summary.text}` : `\nstill getting to know you.`);
      return lines.join("\n");
    }

    case "/remind": {
      if (!arg) return "remind you when? try: /remind 20m take a break · /remind 8:30am check the news · /remind daily 9am what's on today";
      const parsed = parseWhen(arg);
      if (!parsed) return `i couldn't work out when "${arg}" means. try: 20m · 2h · 8:30am · tomorrow 9am · daily 7pm — then what you want.`;
      try {
        const entry = scheduleGoal({ goal: parsed.goal, at: parsed.at, repeatMs: parsed.repeatMs, chatId });
        return `okay — ${describeWhen(entry.at, entry.repeatMs)}: ${entry.goal}\n(${entry.id} · /unschedule ${entry.id} to call it off)`;
      } catch (err) {
        return err.message;
      }
    }

    case "/scheduled":
      return formatSchedule();

    case "/unschedule": {
      if (!arg) return `cancel which one?\n${formatSchedule()}`;
      const removed = cancelScheduled(arg);
      return removed ? `called off: ${removed.goal}` : `nothing scheduled with id "${arg}".`;
    }

    case "/status": {
      const rt = runtimeStatus();
      const llm = llmStatus();
      const pending = pendingDbWrites();
      const lines = [];
      lines.push(`cloud up ${formatDuration(rt.upMs)}${rt.revision ? ` · code ${rt.revision}` : ""}`);
      lines.push(rt.clientConnected
        ? `laptop connected ${formatDuration(rt.clientForMs)} — she can drive the browser`
        : `laptop NOT connected — she cannot touch the browser until you start the client`);
      if (rt.connectors.length) lines.push(`talking to: ${rt.connectors.join(", ")}`);
      lines.push(`memory: ${memoryBackend() === "postgres" ? "postgres" : "local file"}${pending ? ` · ${pending} write${pending === 1 ? "" : "s"} waiting` : ""}`);
      lines.push(`ai: ${llm.primary.join(", ")}${llm.cooling.length ? ` · resting: ${llm.cooling.join(", ")}` : ""}`);
      if (process.env.DRY_RUN === "true") lines.push("DRY RUN on — she will plan but never click, type or submit");
      lines.push(process.env.CONFIRM_RISKY === "false"
        ? "confirmation OFF — she can buy, delete and send without asking"
        : "she asks before buying, deleting or sending");
      if (rt.queueDepth) lines.push(`${rt.queueDepth} goal${rt.queueDepth === 1 ? "" : "s"} waiting`);
      return lines.join("\n");
    }

    case "/last":
      return formatTrace(lastTrace());

    case "/forget": {
      if (!arg) return "forget what? a memory key, or: chat, moods, all";
      if (arg === "chat") { await forgetChat(chatId, "turns"); return "forgot our conversation history."; }
      if (arg === "moods") { await forgetChat(chatId, "moods"); return "forgot the mood history."; }
      if (arg === "all") { await forgetChat(chatId, "all"); return "forgot conversation, events and moods. facts kept — /forget <key> for those."; }
      return forgetFact(arg) ? `forgot "${arg}".` : `i wasn't remembering "${arg}".`;
    }

    default: {
      const near = COMMANDS.filter(c => c.name.startsWith(typedHead)).map(c => c.name);
      if (near.length) return `did you mean ${near.join(" or ")}?`;
      return `unknown command ${typedHead}. /help for the list.`;
    }
  }
}
