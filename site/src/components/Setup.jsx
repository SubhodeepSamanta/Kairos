import Reveal from "./Reveal.jsx";
import { ShieldIcon, MemoryIcon, ClockIcon, SearchIcon, FileIcon, BrainIcon } from "./icons.jsx";

const CODE = [
  { p: "$ ", c: "git clone …/Kairos && cd Kairos" },
  { p: "$ ", c: "cd cloud  && npm install && cd .." },
  { p: "$ ", c: "cd client && npm install && cd .." },
  { p: "", c: "" },
  { p: "# ", c: "one free Groq key in cloud/.env, and you're set", dim: true },
  { p: "$ ", c: "cd cloud  && node index.js", tag: "brain" },
  { p: "$ ", c: "cd client && node index.js", tag: "hands" },
  { p: "› ", c: "startKairos", accent: true }
];

const EXTRAS = [
  { icon: BrainIcon, t: "Free LLMs, with failover", d: "Groq → OpenRouter → NVIDIA, tried in order with rate pacing." },
  { icon: ShieldIcon, t: "Asks before irreversible acts", d: "A deterministic gate pauses before spending, deleting or sending." },
  { icon: MemoryIcon, t: "Remembers across sessions", d: "Facts in Postgres or atomic JSON; secrets stay on your laptop." },
  { icon: ClockIcon, t: "Does things later", d: "/remind 8:30am check the news · /remind daily 9am what's on today." },
  { icon: SearchIcon, t: "Knows things without a browser", d: "Web search and page-fetch answer in one cheap round-trip." },
  { icon: FileIcon, t: "Reads your files", d: "A sandboxed workspace folder; images read via OCR." }
];

export default function Setup() {
  return (
    <section id="setup" className="mx-auto max-w-6xl px-5 py-24">
      <div className="grid items-start gap-12 lg:grid-cols-2">
        <div>
          <Reveal as="p" className="font-mono text-xs uppercase tracking-[0.25em] text-gold-600">
            Set up
          </Reveal>
          <Reveal as="h2" delay={80} className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Two small programs. Two terminals.
          </Reveal>
          <Reveal as="p" delay={140} className="mt-5 text-ink-soft">
            Clone it, install the two halves, drop in one free API key, and start talking —
            from the terminal, from Telegram, or out loud. On first run each half prints a
            preflight report that tells you exactly what's missing instead of crashing.
          </Reveal>

          <Reveal delay={200} className="mt-8 overflow-hidden rounded-xl border border-ink/12 bg-ink shadow-xl shadow-ink/20">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-gold-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-dusk-300" />
              <span className="ml-2 font-mono text-[11px] text-paper/40">terminal</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed">
              {CODE.map((line, i) => (
                <div key={i} className="whitespace-pre">
                  <span className="text-gold-300/70">{line.p}</span>
                  <span className={line.dim ? "text-paper/40" : line.accent ? "text-gold-300" : "text-paper/90"}>
                    {line.c}
                  </span>
                  {line.tag && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-paper/50">{line.tag}</span>}
                </div>
              ))}
            </pre>
          </Reveal>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {EXTRAS.map((e, i) => {
            const Icon = e.icon;
            return (
              <Reveal
                key={e.t}
                delay={i * 90}
                className="card-lift rounded-xl border border-ink/10 bg-paper p-5"
              >
                <Icon className="h-6 w-6 text-gold-600" />
                <h3 className="mt-4 font-display text-base font-semibold">{e.t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{e.d}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
