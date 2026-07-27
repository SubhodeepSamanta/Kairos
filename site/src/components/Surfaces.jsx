import Reveal from "./Reveal.jsx";
import { SURFACES } from "../data.js";
import { BrowserIcon, DesktopIcon, VoiceIcon } from "./icons.jsx";

const ICONS = { browser: BrowserIcon, desktop: DesktopIcon, voice: VoiceIcon };

export default function Surfaces() {
  return (
    <section id="surfaces" className="mx-auto max-w-6xl px-5 py-24">
      <div className="max-w-2xl">
        <Reveal as="p" className="font-mono text-xs uppercase tracking-[0.25em] text-gold-600">
          One loop, three surfaces
        </Reveal>
        <Reveal as="h2" delay={80} className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          The same brain drives everything on your machine.
        </Reveal>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {SURFACES.map((s, i) => {
          const Icon = ICONS[s.key];
          return (
            <Reveal
              key={s.key}
              delay={i * 110}
              className="card-lift group flex flex-col rounded-2xl border border-ink/10 bg-paper p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-50 text-gold-600 ring-1 ring-gold-200/60 transition-colors group-hover:bg-gold-500 group-hover:text-white">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{s.body}</p>
              <ul className="mt-5 flex flex-col gap-2 border-t border-ink/8 pt-4">
                {s.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[13px] text-ink-soft">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
