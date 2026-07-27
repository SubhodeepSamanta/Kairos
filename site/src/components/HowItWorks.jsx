import Reveal from "./Reveal.jsx";
import { LOOP_STEPS } from "../data.js";

export default function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden py-28">
      <div className="grain absolute inset-0 -z-10 opacity-70" />
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal as="p" className="font-mono text-xs uppercase tracking-[0.25em] text-gold-600">
            The loop
          </Reveal>
          <Reveal as="h2" delay={80} className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Four steps, again and again, until it's done.
          </Reveal>
          <Reveal as="p" delay={150} className="mt-5 text-ink-soft">
            No plan is set in stone. Kairos re-reads reality after every action, so it can
            recover when a page changes under it instead of blindly following a script.
          </Reveal>
        </div>

        <div className="relative mt-16 grid gap-4 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-8 -z-10 hidden h-px bg-gradient-to-r from-transparent via-gold-300 to-transparent md:block" />
          {LOOP_STEPS.map((step, i) => (
            <Reveal
              key={step.k}
              delay={i * 120}
              className="card-lift flex flex-col items-center rounded-2xl border border-ink/10 bg-paper p-6 text-center"
            >
              <div className="grid h-16 w-16 place-items-center rounded-full border border-gold-300 bg-paper font-display text-xl font-semibold text-gold-600">
                {i + 1}
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{step.t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{step.d}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200} className="mx-auto mt-14 max-w-3xl rounded-xl border border-ink/10 bg-ink px-6 py-5 text-center">
          <p className="text-sm leading-relaxed text-paper/85">
            The brain runs in the cloud; the hands stay on your laptop. They speak over a
            single authenticated WebSocket — goals and answers one way, actions and
            observations the other. <span className="text-gold-300">Your secrets never make the trip.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
