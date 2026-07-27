const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };

export function BrowserIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18" />
      <circle cx="6.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="8.7" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DesktopIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
      <path d="M7.5 8.5l2 2-2 2M12 12.5h4" />
    </svg>
  );
}

export function VoiceIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function BrainIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M9 4.5A2.5 2.5 0 0 0 6.5 7 2.5 2.5 0 0 0 5 11.2 2.6 2.6 0 0 0 6.5 16 2.4 2.4 0 0 0 9 19.5V4.5Z" />
      <path d="M15 4.5A2.5 2.5 0 0 1 17.5 7 2.5 2.5 0 0 1 19 11.2 2.6 2.6 0 0 1 17.5 16 2.4 2.4 0 0 1 15 19.5V4.5Z" />
      <path d="M12 4v16" />
    </svg>
  );
}

export function ShieldIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 3l7 3v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6l7-3Z" />
      <path d="M9.2 12l1.9 1.9L15 10" />
    </svg>
  );
}

export function MemoryIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="5" y="5" width="14" height="14" rx="2.5" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

export function ClockIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function SearchIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

export function FileIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  );
}

export function GithubIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.22-3.37-1.22-.46-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.14-4.55-5.05 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.92-2.34 4.78-4.57 5.03.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

export function ArrowIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
