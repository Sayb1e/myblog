import type { CSSProperties } from "react";

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <section className="card">
      <div className="skeleton skeleton-title" />
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="skeleton skeleton-line"
          style={{ width: `${92 - index * 14}%` } as CSSProperties}
        />
      ))}
    </section>
  );
}
