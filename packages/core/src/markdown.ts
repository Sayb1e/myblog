export interface Line {
  text: string;
  start: number;
  end: number;
}

export function* iterateLines(markdown: string): Generator<Line> {
  let start = 0;
  while (start <= markdown.length) {
    const newline = markdown.indexOf("\n", start);
    if (newline === -1) {
      yield { text: markdown.slice(start), start, end: markdown.length };
      break;
    }
    const hasCr = newline > start && markdown[newline - 1] === "\r";
    const end = hasCr ? newline - 1 : newline;
    yield { text: markdown.slice(start, end), start, end: newline + 1 };
    start = newline + 1;
  }
}

export function detectEol(text: string): string {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length;
  return crlf > lf ? "\r\n" : "\n";
}

export function isFence(line: string): { marker: string; length: number } | null {
  const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
  if (!match) return null;
  const marker = match[1] ?? "";
  return { marker: marker[0] ?? "`", length: marker.length };
}

export interface Section {
  level: number;
  title: string;
  heading: string;
  start: number;
  bodyStart: number;
  end: number;
  body: string;
  raw: string;
}

export function splitSections(markdown: string, level = 2): Section[] {
  const sections: Section[] = [];
  let fence: { marker: string; length: number } | null = null;

  for (const line of iterateLines(markdown)) {
    if (fence) {
      const close = isFence(line.text);
      if (close && close.marker === fence.marker && close.length >= fence.length) {
        fence = null;
      }
      continue;
    }

    const open = isFence(line.text);
    if (open) {
      fence = open;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line.text);
    if (!heading) continue;
    const hashes = heading[1] ?? "";
    if (hashes.length !== level) continue;

    const title = (heading[2] ?? "").trim();
    sections.push({
      level,
      title,
      heading: line.text,
      start: line.start,
      bodyStart: line.end,
      end: markdown.length,
      body: "",
      raw: "",
    });
  }

  return sections.map((section, index) => {
    const end = index + 1 < sections.length ? (sections[index + 1]?.start ?? markdown.length) : markdown.length;
    return {
      ...section,
      end,
      body: markdown.slice(section.bodyStart, end),
      raw: markdown.slice(section.start, end),
    };
  });
}

export function findSection(sections: Section[], title: string): Section | undefined {
  const needle = title.trim();
  return sections.find((section) => section.title === needle) ?? sections.find((section) => section.title.includes(needle));
}

export function getSection(markdown: string, title: string, level = 2): Section | undefined {
  return findSection(splitSections(markdown, level), title);
}

export function splitParagraphs(body: string): string[] {
  return splitParagraphBlocks(body).map((paragraph) => paragraph.text);
}

export interface ParagraphBlock {
  text: string;
  start: number;
  end: number;
}

export function splitParagraphBlocks(markdown: string): ParagraphBlock[] {
  const blocks: ParagraphBlock[] = [];
  const eol = detectEol(markdown);
  let start = -1;
  let end = -1;
  const lines: string[] = [];

  const flush = () => {
    if (start === -1) return;
    blocks.push({ text: lines.join(eol), start, end });
    start = -1;
    end = -1;
    lines.length = 0;
  };

  for (const line of iterateLines(markdown)) {
    if (line.text.trim() === "") {
      flush();
      continue;
    }
    if (start === -1) start = line.start;
    end = line.start + line.text.length;
    lines.push(line.text);
  }
  flush();
  return blocks;
}

export function matchLabel(text: string, label: string): boolean {
  return new RegExp(`^\\s*${label}\\s*[:：]`).test(text);
}

export function upsertLabeledParagraph(body: string, label: string, value: string): string {
  const eol = detectEol(body);
  const blocks = splitParagraphBlocks(body);
  const target = blocks.find((block) => matchLabel(block.text, label));
  const replacement = `${label}：${value.replace(/\r?\n/g, eol)}`;
  if (!target) {
    const separator = body.endsWith("\n") ? "" : eol;
    return `${body}${separator}${eol}${replacement}${eol}`;
  }
  return `${body.slice(0, target.start)}${replacement}${body.slice(target.end)}`;
}

export function readLabeledParagraph(body: string, label: string): string {
  const block = splitParagraphBlocks(body).find((entry) => matchLabel(entry.text, label));
  if (!block) return "";
  return block.text.replace(new RegExp(`^\\s*${label}\\s*[:：]\\s*`), "").trim();
}
