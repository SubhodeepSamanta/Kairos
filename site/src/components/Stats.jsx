import { useReveal, useCountUp } from "../lib/useReveal.js";
import { useEffect, useState } from "react";
import { STATS } from "../data.js";

function Stat({ value, label, sub, active }) {
  const ref = useCountUp(value, active);
  return (
    <div className="text-center">
      <div className="font-display text-4xl font-semibold text-ink sm:text-5xl">
        <span ref={ref}>0</span>
      </div>
      <div className="mt-2 text-sm font-medium text-ink">{label}</div>
      <div className="mt-0.5 font-mono text-[11px] text-ink-faint">{sub}</div>
    </div>
  );
}

export default function Stats() {
  const ref = useReveal({ threshold: 0.4 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setActive(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [ref]);

  return (
    <section ref={ref} className="border-y border-ink/10 bg-paper-2/50 py-20">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-12 px-5 md:grid-cols-4">
        {STATS.map((s) => (
          <Stat key={s.label} {...s} active={active} />
        ))}
      </div>
    </section>
  );
}
