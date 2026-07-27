import { useEffect, useState } from "react";
import { REPO } from "../data.js";
import { GithubIcon, ArrowIcon } from "./icons.jsx";
import AgentCard from "./AgentCard.jsx";

const WORDS = ["browser", "desktop", "voice"];

export default function Hero() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % WORDS.length), 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="grain dotgrid absolute inset-0 -z-10" />
      <div className="absolute -left-24 top-24 -z-10 h-72 w-72 rounded-full bg-gold-200/40 blur-3xl animate-drift" />
      <div className="absolute -right-16 top-48 -z-10 h-80 w-80 rounded-full bg-dusk-300/30 blur-3xl animate-drift" style={{ animationDelay: "-6s" }} />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:pt-40">
        <div className="rise">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-paper/60 px-3.5 py-1.5 text-xs font-medium text-ink-soft backdrop-blur transition-colors hover:text-ink"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
            Open-source · runs on your own machine
          </a>

          <h1 className="mt-6 font-display text-[2.7rem] font-semibold leading-[1.04] tracking-tight sm:text-6xl">
            The assistant that
            <br className="hidden sm:block" /> drives your{" "}
            <span className="text-gradient">real computer</span>.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            You talk to Kairos from Telegram, a terminal, or out loud. It looks at what's
            actually on the screen, decides one step at a time, and does it across your{" "}
            <span className="relative inline-block min-w-[5.5ch] font-medium text-ink">
              <span key={i} className="caret rise text-gold-600">{WORDS[i]}</span>
            </span>
            . Your passwords never leave your laptop.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper shadow-lg shadow-ink/15 transition-transform hover:-translate-y-0.5"
            >
              <GithubIcon className="h-4.5 w-4.5" />
              View the code
            </a>
            <a
              href="#how"
              className="group inline-flex items-center gap-2 rounded-full border border-ink/15 px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-ink/40"
            >
              How it works
              <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>

          <dl className="mt-10 flex flex-wrap gap-x-9 gap-y-4">
            {[
              ["697", "tests, all green"],
              ["3", "surfaces, one loop"],
              ["Node 18+", "two npm packages"]
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="font-display text-2xl font-semibold">{n}</dt>
                <dd className="text-xs text-ink-faint">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-gold-100/60 to-dusk-300/40 blur-2xl" />
          <AgentCard />
        </div>
      </div>
    </section>
  );
}
