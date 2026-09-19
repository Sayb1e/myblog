import { detectEol, iterateLines } from "./markdown.js";

export interface Table {
  header: string[];
  rows: string[][];
  headerLine: string;
  separatorLine: string;
  rowLines: string[];
  start: number;
  end: number;
}

export function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "\\" && trimmed[index + 1] === "|") {
      current += "|";
      index += 1;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function isSeparatorRow(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s/g, "")));
}

export function findFirstTable(body: string, offset = 0): Table | null {
  const lines = [...iterateLines(body)];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line || !line.text.trim().startsWith("|")) {
      index += 1;
      continue;
    }

    const block: { line: (typeof lines)[number]; absoluteStart: number }[] = [];
    while (index < lines.length) {
      const current = lines[index];
      if (!current || !current.text.trim().startsWith("|")) break;
      block.push({ line: current, absoluteStart: offset + current.start });
      index += 1;
    }

    if (block.length < 2) continue;
    const header = block[0];
    const separator = block[1];
    if (!header || !separator || !isSeparatorRow(separator.line.text)) continue;

    const rowLines = block.slice(2);
    const first = block[0];
    const last = block[block.length - 1];
    if (!first || !last) continue;

    return {
      header: splitTableRow(header.line.text),
      rows: rowLines.map((entry) => splitTableRow(entry.line.text)),
      headerLine: header.line.text,
      separatorLine: separator.line.text,
      rowLines: rowLines.map((entry) => entry.line.text),
      start: first.absoluteStart,
      end: offset + last.line.end,
    };
  }

  return null;
}

export function escapeCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

export function formatTableRow(cells: string[]): string {
  return `| ${cells.map(escapeCell).join(" | ")} |`;
}

export function insertTableRow(
  markdown: string,
  table: Table,
  cells: string[],
  position: "top" | "bottom" = "top",
): string {
  const row = formatTableRow(cells);
  const eol = detectEol(markdown);
  if (position === "bottom") {
    return `${markdown.slice(0, table.end)}${row}${eol}${markdown.slice(table.end)}`;
  }

  const headerEnd = markdown.indexOf("\n", table.start);
  const separatorEnd = headerEnd === -1 ? -1 : markdown.indexOf("\n", headerEnd + 1);
  const insertAt = separatorEnd === -1 ? markdown.length : separatorEnd + 1;
  return `${markdown.slice(0, insertAt)}${row}${eol}${markdown.slice(insertAt)}`;
}

export function parseLink(cell: string): { text: string; target: string } | null {
  const match = /\[([^\]]*)\]\(([^)]*)\)/.exec(cell);
  if (!match) return null;
  return { text: match[1] ?? "", target: match[2] ?? "" };
}
