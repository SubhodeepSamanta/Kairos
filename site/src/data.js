export const REPO = "https://github.com/SubhodeepSamanta/Kairos";
export const SITE = "https://kairosbysubhodeep.vercel.app";

export const NAV = [
  { label: "The idea", href: "#idea" },
  { label: "Surfaces", href: "#surfaces" },
  { label: "How it works", href: "#how" },
  { label: "See it", href: "#gallery" },
  { label: "Set up", href: "#setup" }
];

export const CAPABILITIES = [
  "drive your real browser",
  "type inside Notepad",
  "do maths in the Calculator",
  "play music",
  "log into accounts",
  "search the web",
  "read a page back to you",
  "listen and talk",
  "remember your name",
  "set a reminder",
  "fill a form",
  "ask before it spends money"
];

export const STATS = [
  { value: 697, label: "automated tests", sub: "cloud 314 · client 383" },
  { value: 124, label: "source files", sub: "two lean packages" },
  { value: 3, label: "surfaces, one loop", sub: "browser · desktop · voice" },
  { value: 0, label: "passwords leave your laptop", sub: "only {{secret:name}}" }
];

export const SURFACES = [
  {
    key: "browser",
    title: "The browser",
    body: "Your actual Chrome, Brave or Edge — logged in as you, with human-like mouse, typing and think-time. Or a private Kairos window that keeps its own logins, or a throwaway Chromium for anonymous work.",
    points: ["Playwright on the real accessibility tree", "Real profiles, or a clean Kairos window", "Human timing, not a robot cursor"]
  },
  {
    key: "desktop",
    title: "Native Windows apps",
    body: "Opens Notepad and types a note, does maths in the Calculator and reads the answer off the screen, plays music, logs into desktop apps — through UI Automation control patterns, never blind screen coordinates.",
    points: ["Invoke / Value / Toggle patterns", "Survives window moves and DPI changes", "One loop retargets cleanly to the desktop"]
  },
  {
    key: "voice",
    title: "Its own voice",
    body: "A full local voice stack: wake word, room-noise calibration, real-time transcription and natural speech — with barge-in, so you can cut it off mid-sentence and it stops to listen.",
    points: ["Moonshine speech-to-text on device", "Kokoro text-to-speech, chosen by benchmark", "Barge-in with echo learning"]
  }
];

export const FEATURES = [
  {
    tag: "Companion",
    title: "It remembers you between sessions",
    body: "Usernames, resolved site URLs, your tastes and preferences persist — so after it finds a site once, it goes straight there next time. It has a personality you can switch, and an optional read on your mood. If you ever express distress, a hard-coded crisis gate steps in with real helpline information.",
    shot: "/screenshots/01-telegram.png",
    alt: "Kairos on Telegram"
  },
  {
    tag: "Honest by design",
    title: "You can always see what it's doing",
    body: "The console narrates every step as it happens. /status answers 'is this actually working' in one screen — cloud uptime, the exact commit it's running, whether the laptop is connected, which models are cooling down. /last replays the steps of the most recent goal, even after a restart.",
    shot: "/screenshots/02-cli-console.png",
    alt: "The Kairos CLI console"
  },
  {
    tag: "Real browser",
    title: "It acts on the live page, logged in as you",
    body: "Every turn it reads a fresh, numbered snapshot of the page and picks one element. After each action the page is re-read, so element ids can never go stale. There's no code that guesses which button is the login button — the model decides, on what's actually on screen right now.",
    shot: "/screenshots/03-browser.png",
    alt: "Kairos driving a real browser"
  },
  {
    tag: "Beyond the browser",
    title: "It works inside native apps too",
    body: "The same loop drives Windows apps through the accessibility tree — opening an app, reading its controls, typing into the right field, pressing a shortcut. It reports only what the window actually shows: if the Calculator reads 504, the answer is 504, never its own arithmetic.",
    shot: "/screenshots/04-desktop.png",
    alt: "Kairos working in a native Windows app"
  }
];

export const LOOP_STEPS = [
  { k: "snapshot", t: "Snapshot", d: "The current surface — page or window — becomes a numbered list of interactive elements." },
  { k: "decide", t: "Decide", d: "One LLM call over the goal, memories, history and that snapshot returns exactly one JSON action." },
  { k: "act", t: "Act", d: "The client executes it on the real browser or the real desktop — nothing else." },
  { k: "observe", t: "Observe", d: "The surface is re-read into a fresh snapshot, so ids never go stale, and the loop turns again." }
];
