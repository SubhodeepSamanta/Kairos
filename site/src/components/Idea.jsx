import Reveal from "./Reveal.jsx";

export default function Idea() {
  return (
    <section id="idea" className="mx-auto max-w-4xl px-5 py-28 text-center">
      <Reveal as="p" className="font-mono text-xs uppercase tracking-[0.25em] text-gold-600">
        The idea
      </Reveal>
      <Reveal
        as="h2"
        delay={80}
        className="mt-6 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[2.6rem]"
      >
        The model reasons.
        <br />
        The code only <span className="text-gradient">acts</span>.
      </Reveal>
      <Reveal as="p" delay={160} className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-ink-soft">
        Every turn, Kairos hands the language model a fresh, numbered snapshot of whatever
        it's looking at and gets back exactly one action. There are no regex classifiers,
        no heuristics guessing which button is the login button. If it ever picks wrong,
        the fix is the prompt or the snapshot — <span className="font-medium text-ink">never a special-case rule</span>.
      </Reveal>

      <Reveal delay={220} className="mx-auto mt-10 max-w-lg rounded-xl border border-ink/12 bg-paper-2/60 p-5 text-left font-mono text-[13px] leading-relaxed text-ink-soft">
        <span className="text-ink-faint">// one reply, every turn</span>
        <br />
        {"{ "}
        <span className="text-dusk-600">"thought"</span>: <span className="text-gold-700">"click the first result"</span>,
        <br />
        <span className="pl-3" />
        <span className="text-dusk-600">"action"</span>: {"{ "}
        <span className="text-dusk-600">"type"</span>: <span className="text-gold-700">"click"</span>,{" "}
        <span className="text-dusk-600">"id"</span>: 12 {"}"}
        <br />
        {"}"}
      </Reveal>
    </section>
  );
}
