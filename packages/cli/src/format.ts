export { diffLines } from "@myblog/core";

export function firstLine(text: string): string {
  return text.split(/\r?\n/).find((line) => line.trim() !== "")?.trim() ?? "";
}
