import { REPO, NAV } from "../data.js";
import { GithubIcon } from "./icons.jsx";

export default function Footer() {
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src="/screenshots/logo.png" alt="Kairos" className="h-10 w-10 rounded-full ring-1 ring-ink/10" />
          <div>
            <div className="font-display text-lg font-semibold">Kairos</div>
            <div className="text-xs text-ink-faint">An assistant that drives your real computer.</div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="text-sm text-ink-soft transition-colors hover:text-ink">
              {item.label}
            </a>
          ))}
        </nav>

        <a
          href={REPO}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 self-start rounded-full border border-ink/15 px-4 py-2 text-sm text-ink transition-colors hover:border-ink/40 sm:self-auto"
        >
          <GithubIcon className="h-4 w-4" />
          Source
        </a>
      </div>
      <div className="border-t border-ink/8 py-5">
        <p className="text-center text-xs text-ink-faint">
          ISC © {new Date().getFullYear()} Subhodeep Samanta · Built with React, Vite &amp; Tailwind
        </p>
      </div>
    </footer>
  );
}
