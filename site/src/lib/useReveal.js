import { useEffect, useRef } from "react";

export function useReveal(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: options.threshold ?? 0.15, rootMargin: options.rootMargin ?? "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin]);

  return ref;
}

export function useCountUp(target, active, duration = 1400) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const node = ref.current;
    const start = performance.now();
    let frame;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = Math.round(target * eased).toLocaleString();
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);

  return ref;
}
