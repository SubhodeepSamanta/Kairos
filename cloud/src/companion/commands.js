import { listPersonas, getPersona, PERSONAS } from "./personas.js";
import { getPrefs, setPrefs, loadMoods, loadEvents, getSummary, forgetChat } from "./store.js";
import { formatMood } from "./context.js";
import { getAllFacts, forgetFact } from "../memory/store.js";

export const COMMANDS = [
  { name: "/personality", args: "[name]", help: "switch how Kairos talks to you" },
  { name: "/mood", args: "[on|off|clear]", help: "see or control the mood read" },
  { name: "/memory", args: "", help: "what Kairos remembers about you" },
  { name: "/recent", args: "", help: "what you did recently" },
  { name: "/about", args: "", help: "who Kairos thinks you are" },
  { name: "/forget", args: "<key|chat|moods|all>", help: "make Kairos forget something" },
  { name: "/help", args: "", help: "show commands" }
];

export function commandSuggestions(input) {
  const text = String(input || "");
  if (!text.startsWith("/")) return null;

  const [head, ...rest] = text.trimStart().split(/\s+/);
  const typedArg = rest.join(" ");

  if (head === "/personality" && text.includes(" ")) {
    return {
      kind: "value",
      command: "/personality",
      items: listPersonas()
        .filter(p => p.id.startsWith(typedArg.toLowerCase()))
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

export async function runCommand(chatId, text) {
  const [head, ...rest] = String(text).trim().split(/\s+/);
  const arg = rest.join(" ").trim();

  switch (head) {
    case "/help":
      return COMMANDS.map(c => `${c.name}${c.args ? " " + c.args : ""} — ${c.help}`).join("\n");

    case "/personality": {
      const prefs = await getPrefs(chatId);
      if (!arg) {
        const lines = listPersonas().map(p => `${p.id === prefs.persona ? "▸" : " "} ${p.id.padEnd(8)} ${p.blurb}`);
        return `personalities:\n${lines.join("\n")}\n\nswitch with /personality <name>`;
      }
      const key = arg.toLowerCase();
      if (!PERSONAS[key]) {
        return `no personality called "${arg}". options: ${Object.keys(PERSONAS).join(", ")}`;
      }
      await setPrefs(chatId, { persona: key });
      const p = getPersona(key);
      return `${p.label} it is — ${p.blurb}\n\n"${p.samples[0]}"`;
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
      if (!entries.length) return "i don't know anything about you yet.";
      return `what i remember:\n${entries.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n/forget <key> to remove one`;
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
      const lines = [`you're talking to ${persona.label} — ${persona.blurb}.`];
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

    case "/forget": {
      if (!arg) return "forget what? a memory key, or: chat, moods, all";
      if (arg === "chat") { await forgetChat(chatId, "turns"); return "forgot our conversation history."; }
      if (arg === "moods") { await forgetChat(chatId, "moods"); return "forgot the mood history."; }
      if (arg === "all") { await forgetChat(chatId, "all"); return "forgot conversation, events and moods. facts kept — /forget <key> for those."; }
      return forgetFact(arg) ? `forgot "${arg}".` : `i wasn't remembering "${arg}".`;
    }

    default:
      return `unknown command ${head}. /help for the list.`;
  }
}
