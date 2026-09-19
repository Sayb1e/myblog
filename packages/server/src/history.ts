import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export interface StoredTool {
  name: string;
  args: string;
  result: unknown;
}

export interface StoredMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  tools: StoredTool[];
}

interface HistoryFile {
  root: string;
  updatedAt: string;
  messages: StoredMessage[];
}

export function defaultHistoryDir(): string {
  return path.join(homedir(), ".myblog", "history");
}

function fileFor(root: string, historyDir: string): string {
  const id = createHash("sha1").update(root).digest("hex").slice(0, 16);
  return path.join(historyDir, `${id}.json`);
}

export async function readHistory(root: string, historyDir: string): Promise<StoredMessage[]> {
  try {
    const raw = await readFile(fileFor(root, historyDir), "utf8");
    const parsed = JSON.parse(raw) as Partial<HistoryFile>;
    return Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch {
    return [];
  }
}

export async function writeHistory(root: string, historyDir: string, messages: StoredMessage[]): Promise<void> {
  const file = fileFor(root, historyDir);
  await mkdir(path.dirname(file), { recursive: true });
  const data: HistoryFile = {
    root,
    updatedAt: new Date().toISOString(),
    messages: messages.slice(-200),
  };
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
