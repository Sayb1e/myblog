import type { ReactNode } from "react";
import type { AchievementIcon, Tier } from "../achievements.js";

export const ACHIEVEMENT_ICONS: Record<AchievementIcon, ReactNode> = {
  book: (
    <>
      <path d="M12 6.5C10.2 5.2 8 4.7 6 5v12.5c2-.3 4.2.2 6 1.5 1.8-1.3 4-1.8 6-1.5V5c-2-.3-4.2.2-6 1.5z" />
      <path d="M12 6.5V19" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20l4-1L18 9l-3-3L5 16z" />
      <path d="M13 6l3 3M4 20l1-4" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l8 4-8 4-8-4z" />
      <path d="M4.5 12L12 15.5 19.5 12" />
      <path d="M4.5 16L12 19.5 19.5 16" />
    </>
  ),
  library: (
    <>
      <rect x="4" y="4" width="4.5" height="16" rx="1" />
      <rect x="9.5" y="4" width="4.5" height="16" rx="1" />
      <path d="M16.2 5.2l3.6.9-3.2 13.9-3.6-.9z" />
    </>
  ),
  flame: (
    <>
      <path d="M12 21a6 6 0 0 0 6-6c0-3-2.5-5.5-4.5-8-.4 2-1.5 2.8-2.4 2.2C11.5 7 11.8 5 12 3c-2.5 2.5-6 5.4-6 12a6 6 0 0 0 6 6z" />
      <path d="M12 21a2.4 2.4 0 0 0 2.4-2.4c0-1.7-2.4-3.6-2.4-3.6s-2.4 1.9-2.4 3.6A2.4 2.4 0 0 0 12 21z" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 9.5h16M8 3v4M16 3v4" />
      <path d="M8.5 14.5l2 2 4-4" />
    </>
  ),
  moon: (
    <>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </>
  ),
  "moon-star": (
    <>
      <path d="M17 15A7 7 0 1 1 8.7 5.8 5.7 5.7 0 0 0 17 15z" />
      <path d="M18 3l.9 2.1L21 6l-2.1.9L18 9l-.9-2.1L15 6l2.1-.9z" />
    </>
  ),
  mountain: (
    <>
      <path d="M3 20l6.5-11 3.5 5.5L15.5 11 21 20z" />
      <path d="M7.5 14.5l2-3 2 2" />
      <path d="M9.5 9V4.5h3l-2 2.5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  steps: (
    <>
      <path d="M4 20h4v-4h4v-4h4V8h4" />
    </>
  ),
  furnace: (
    <>
      <path d="M7 4h10v3H7z" />
      <path d="M6 7h12l-1.5 13H7.5z" />
      <path d="M12 17c-1.6-1.6-2.2-2.8-2.2-4.2a2.2 2.2 0 1 1 4.4 0c0 1.4-.6 2.6-2.2 4.2z" />
    </>
  ),
  gem: (
    <>
      <path d="M6.5 3h11L21 9l-9 12L3 9z" />
      <path d="M3 9h18M9 3l3 6 3-6M12 9v12" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14c0-3 2-5 5.5-5 0 3-2 5-5.5 5z" />
      <path d="M12 14c0-3-2-5-5.5-5 0 3 2 5 5.5 5z" />
    </>
  ),
  stairs: (
    <>
      <path d="M4 20h4v-4h4v-4h4V8h4" />
      <path d="M20 3v4M17.5 5.5L20 3l2.5 2.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 12l7-7" />
    </>
  ),
  blueprint: (
    <>
      <rect x="3" y="4" width="18" height="15" rx="2" />
      <path d="M3 9h18M9 4v15M13 16l3-3 2 2-3 3z" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
    </>
  ),
  "chat-question": (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M10.2 9a1.9 1.9 0 0 1 3.4 1.2c0 1.3-1.6 1.4-1.6 2.8M12 15h.01" />
    </>
  ),
  quote: (
    <>
      <path d="M9 7c-2 1-3 2.6-3 5v5h5v-5H8c0-1.8.4-3 1-3.6z" />
      <path d="M18 7c-2 1-3 2.6-3 5v5h5v-5h-3c0-1.8.4-3 1-3.6z" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M13 15h4" />
    </>
  ),
  git: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="8" r="2.4" />
      <path d="M6 8.4v7.2M18 10.4c0 3-2.4 4.2-5.4 4.2H8.2" />
    </>
  ),
  puzzle: (
    <>
      <path d="M9 4a2 2 0 0 1 4 0v1h4a1 1 0 0 1 1 1v4h1a2 2 0 1 1 0 4h-1v4a1 1 0 0 1-1 1h-4v-1a2 2 0 1 0-4 0v1H5a1 1 0 0 1-1-1v-4h1a2 2 0 1 0 0-4H4V6a1 1 0 0 1 1-1h4z" />
    </>
  ),
};

interface Props {
  icon: AchievementIcon;
  tier: Tier;
  done: boolean;
  /** 进度 0..1（未达成时画在圆环上） */
  ratio?: number;
  size?: number;
  className?: string;
}

const RADIUS = 21;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function AchievementBadge({ icon, tier, done, ratio = 0, size = 72, className = "" }: Props) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <svg
      className={`ach-badge rarity-${tier}${done ? " done" : ""}${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <circle className="ach-ring" cx="24" cy="24" r={RADIUS} />
      {!done && clamped > 0 && (
        <circle
          className="ach-ring-fill"
          cx="24"
          cy="24"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
          transform="rotate(-90 24 24)"
        />
      )}
      <circle className="ach-disc" cx="24" cy="24" r="17" />
      <g
        className="ach-glyph"
        transform="translate(24 24) scale(0.64) translate(-12 -12)"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ACHIEVEMENT_ICONS[icon]}
      </g>
    </svg>
  );
}
