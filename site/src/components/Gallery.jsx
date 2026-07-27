import Reveal from "./Reveal.jsx";
import Shot from "./Shot.jsx";

const SHOTS = [
  { src: "/screenshots/03-browser.png", alt: "Driving a real browser", span: "md:col-span-2" },
  { src: "/screenshots/04-desktop.png", alt: "Inside a native app", span: "" },
  { src: "/screenshots/02-cli-console.png", alt: "The CLI console", span: "" },
  { src: "/screenshots/01-telegram.png", alt: "On Telegram", span: "md:col-span-2" }
];

export default function Gallery() {
  return (
    <section id="gallery" className="mx-auto max-w-6xl px-5 py-24">
      <div className="max-w-2xl">
        <Reveal as="p" className="font-mono text-xs uppercase tracking-[0.25em] text-gold-600">
          See it
        </Reveal>
        <Reveal as="h2" delay={80} className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Real runs, on a real machine.
        </Reveal>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {SHOTS.map((s, i) => (
          <Reveal
            key={s.alt}
            delay={i * 90}
            className={`card-lift group overflow-hidden rounded-2xl border border-ink/10 bg-paper-2 ${s.span}`}
          >
            <div className="relative">
              <Shot
                src={s.src}
                alt={s.alt}
                className="aspect-[16/10] w-full object-cover object-top"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="font-mono text-xs text-paper">{s.alt}</span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
