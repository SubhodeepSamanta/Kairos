import { useState } from "react";

export default function Shot({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`grid place-items-center bg-paper-2 text-ink-faint ${className}`}>
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <span className="font-mono text-xs uppercase tracking-widest">{alt}</span>
          <span className="text-[11px]">screenshot goes here</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
