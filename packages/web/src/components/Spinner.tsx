import { useEffect, useState } from "react";
import { usePrefs } from "../prefs.js";

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ label }: { label?: string }) {
  const { prefs } = usePrefs();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!prefs.animations) return;
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => window.clearInterval(timer);
  }, [prefs.animations]);

  if (!prefs.animations) {
    return (
      <span className="spinner-wrap">
        <span className="spinner" aria-hidden="true">
          ⋯
        </span>
        {label && <span className="spinner-label">{label}</span>}
      </span>
    );
  }

  return (
    <span className="spinner-wrap">
      <span className="spinner" aria-hidden="true">
        {SPINNER_FRAMES[frame]}
      </span>
      {label && <span className="spinner-label">{label}</span>}
    </span>
  );
}
