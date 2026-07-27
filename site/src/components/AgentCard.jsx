import { useEffect, useState, useRef } from "react";

const SCRIPT = [
  { role: "you", text: "note down my 3pm interview, then play some lofi" },
  { role: "thought", text: "open Notepad on the desktop first" },
  { role: "action", text: "open_app { app: \"Notepad\" }" },
  { role: "obs", text: "desktop · Notepad focused · 1 text area" },
  { role: "action", text: "type_into { id: 1, text: \"Interview — 3:00 PM\" }" },
  { role: "thought", text: "now the music, in the browser" },
  { role: "action", text: "navigate { url: \"youtube.com/results?…lofi\" }" },
  { role: "action", text: "click { id: 12 }  →  playing" },
  { role: "done", text: "Noted your 3pm interview and put on a lofi mix. 🎧" }
];

const STYLES = {
  you: "bg-ink text-paper",
  thought: "bg-paper-2 text-ink-soft italic",
  action: "bg-gold-50 text-gold-700 font-mono",
  obs: "bg-dusk-500/8 text-dusk-600 font-mono",
  done: "bg-gold-500 text-white"
};

const LABEL = { you: "goal", thought: "thought", action: "action", obs: "observation", done: "done" };

export default function AgentCard() {
  const [count, setCount] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (count >= SCRIPT.length) {
      const reset = setTimeout(() => setCount(0), 3200);
      return () => clearTimeout(reset);
    }
    const speed = SCRIPT[count].role === "done" ? 900 : 620;
    const id = setTimeout(() => setCount((c) => c + 1), speed);
    return () => clearTimeout(id);
  }, [count]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [count]);

  return (
    <div className="card-lift overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-xl shadow-ink/10">
      <div className="flex items-center gap-2 border-b border-ink/8 bg-paper-2/70 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-rose-400/80" />
        <span className="h-3 w-3 rounded-full bg-gold-300" />
        <span className="h-3 w-3 rounded-full bg-dusk-300" />
        <span className="ml-2 font-mono text-xs text-ink-faint">kairos — live agent loop</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          running
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex h-[20rem] flex-col gap-2.5 overflow-y-auto p-3 sm:h-[24rem] sm:p-4 scroll-smooth"
      >
        {SCRIPT.slice(0, count).map((line, idx) => (
          <div key={idx} className="rise flex items-start gap-1.5 sm:gap-2.5">
            <span className="mt-1 w-[3.5rem] shrink-0 text-right font-mono text-[9px] uppercase tracking-wider text-ink-faint sm:w-[4.7rem] sm:text-[10px]">
              {LABEL[line.role]}
            </span>
            <span className={`min-w-0 break-words rounded-lg px-2 py-1 text-[12px] leading-snug sm:px-3 sm:py-1.5 sm:text-[13px] ${STYLES[line.role]}`}>
              {line.text}
            </span>
          </div>
        ))}
        {count < SCRIPT.length && (
          <div className="flex items-center gap-2 pl-[4rem] pt-1 text-ink-faint sm:pl-[5.4rem]">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: "140ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: "280ms" }} />
          </div>
        )}
      </div>
    </div>
  );
}
