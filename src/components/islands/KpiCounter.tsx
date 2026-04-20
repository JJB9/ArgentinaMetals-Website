import { useEffect, useRef, useState } from "react";

const CIRCUMFERENCE = 478;

interface KpiCounterProps {
  title: string;
  description: string;
  ringOffset: number;
  label: string;
  animateTo?: number;
  animateDecimals?: number;
  animatePrefix?: string;
  animateSuffix?: string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function KpiCounter({
  title,
  description,
  ringOffset,
  label,
  animateTo,
  animateDecimals = 0,
  animatePrefix = "",
  animateSuffix = ""
}: KpiCounterProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setProgress(1);
      return;
    }

    let rafId = 0;
    let startTs = 0;
    const duration = 1200;

    const tick = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(easeOutCubic(t));
      if (t < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const animatedOffset = CIRCUMFERENCE - (CIRCUMFERENCE - ringOffset) * progress;

  let displayLabel = label;
  if (animateTo !== undefined) {
    const current = animateTo * progress;
    const numeric = current.toFixed(animateDecimals);
    displayLabel = `${animatePrefix}${numeric}${animateSuffix}`;
  }

  return (
    <article className="ring" ref={ref}>
      <div className="ring-svg">
        <svg viewBox="0 0 168 168" aria-hidden="true">
          <circle className="track" cx="84" cy="84" r="76" fill="none" strokeWidth="3" />
          <circle
            className="fill"
            cx="84"
            cy="84"
            r="76"
            fill="none"
            strokeWidth="8"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={animatedOffset}
          />
        </svg>
        <div className="ring-val">{displayLabel}</div>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
