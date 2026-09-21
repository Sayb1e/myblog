import type { CSSProperties } from "react";

export function revealStyle(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}
