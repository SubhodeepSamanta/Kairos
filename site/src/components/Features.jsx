import Reveal from "./Reveal.jsx";
import Shot from "./Shot.jsx";
import { FEATURES } from "../data.js";

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-20">
      <div className="flex flex-col gap-24">
        {FEATURES.map((f, i) => {
          const flip = i % 2 === 1;
          return (
            <div
              key={f.title}
              className="grid items-center gap-10 lg:grid-cols-2"
            >
              <Reveal className={flip ? "lg:order-2" : ""}>
                <span className="inline-block rounded-full bg-gold-50 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-gold-700 ring-1 ring-gold-200/60">
                  {f.tag}
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
                  {f.title}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{f.body}</p>
              </Reveal>

              <Reveal delay={120} className={flip ? "lg:order-1" : ""}>
                <div className="card-lift group relative overflow-hidden rounded-2xl border border-ink/10 bg-paper-2 shadow-lg shadow-ink/5">
                  <div className="flex items-center gap-1.5 border-b border-ink/8 bg-paper/70 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-gold-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-dusk-300" />
                  </div>
                  <Shot
                    src={f.shot}
                    alt={f.alt}
                    className="aspect-[16/10] w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                </div>
              </Reveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}
