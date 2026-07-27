import Reveal from "./Reveal.jsx";
import { REPO } from "../data.js";
import { GithubIcon, ArrowIcon } from "./icons.jsx";

export default function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <Reveal className="relative overflow-hidden rounded-3xl border border-ink/10 bg-ink px-6 py-16 text-center">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-dusk-500/25 blur-3xl" />
        <img src="/screenshots/logo.png" alt="Kairos" className="mx-auto h-16 w-16 rounded-full ring-2 ring-white/15" />
        <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
          Give it a real machine to drive.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-paper/70">
          Kairos is open source and runs on your own hardware. Read the code, clone it,
          and have it working in a few minutes.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3 text-sm font-medium text-ink transition-transform hover:-translate-y-0.5"
          >
            <GithubIcon className="h-4.5 w-4.5" />
            Star it on GitHub
          </a>
          <a
            href="#setup"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-paper transition-colors hover:border-white/50"
          >
            Read the setup
            <ArrowIcon className="h-4 w-4" />
          </a>
        </div>
      </Reveal>
    </section>
  );
}
