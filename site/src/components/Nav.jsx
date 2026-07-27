import { useEffect, useState } from "react";
import { NAV, REPO } from "../data.js";
import { GithubIcon } from "./icons.jsx";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-ink/10 bg-paper/85 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <a href="#top" className="flex items-center gap-2.5">
          <img src="/screenshots/logo.png" alt="Kairos" className="h-9 w-9 rounded-full ring-1 ring-ink/10" />
          <span className="font-display text-xl font-semibold tracking-tight">Kairos</span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-transform hover:-translate-y-0.5 sm:inline-flex"
          >
            <GithubIcon className="h-4 w-4" />
            GitHub
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 md:hidden"
          >
            <span className="text-lg leading-none">{open ? "×" : "≡"}</span>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-ink/10 bg-paper px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-sm text-ink-soft"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
