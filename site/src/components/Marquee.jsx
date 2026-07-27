import { CAPABILITIES } from "../data.js";

export default function Marquee() {
  const row = [...CAPABILITIES, ...CAPABILITIES];
  return (
    <div className="relative overflow-hidden border-y border-ink/10 bg-paper-2/50 py-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-paper to-transparent" />
      <div className="flex w-max animate-marquee gap-3">
        {row.map((cap, i) => (
          <span
            key={i}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-ink/10 bg-paper px-4 py-1.5 text-sm text-ink-soft"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            {cap}
          </span>
        ))}
      </div>
    </div>
  );
}
