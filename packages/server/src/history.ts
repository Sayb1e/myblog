import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
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

export interface SessionMeta {
  id: string;
  title: string;
  folder: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionIndex {
  active: string;
  sessions: SessionMeta[];
}

interface LooseIndex {
  active?: string;
  sessions?: (SessionMeta & { folder?: string })[];
}

interface MessagesFile {
  messages?: StoredMessage[];
}

interface WorkspaceManifest {
  root: string;
  label: string;
  updatedAt: string;
}

const MANIFEST_FILE = "workspace.json";

export function defaultHistoryDir(): string {
  return path.join(homedir(), ".myblog", "history");
}

function hashOf(root: string, length: number): string {
  return createHash("sha1").update(root).digest("hex").slice(0, length);
}

function indexPath(dir: string): string {
  return path.join(dir, "index.json");
}

function messagesPath(dir: string, folder: string): string {
  return path.join(dir, folder, "messages.json");
}

function newId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function sanitize(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  return cleaned.slice(0, 60) || "session";
}

function uniqueFolder(sessions: SessionMeta[], base: string, excludeId?: string): string {
  const used = new Set(sessions.filter((session) => session.id !== excludeId).map((session) => session.folder));
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

function nextTitle(sessions: SessionMeta[]): string {
  const numbers = sessions
    .map((session) => /^新对话(\d+)$/.exec(session.title)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : sessions.length + 1;
  return `新对话${next}`;
}

function deriveTitle(messages: StoredMessage[]): string {
  const first = messages.find((message) => message.role === "user" && message.content.trim() !== "");
  if (!first) return "";
  const text = first.content.replace(/\s+/g, " ").trim();
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function subDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function writeManifest(dir: string, root: string, label?: string): Promise<void> {
  const manifest: WorkspaceManifest = { root, label: label ?? "", updatedAt: new Date().toISOString() };
  await writeJson(path.join(dir, MANIFEST_FILE), manifest);
}

/**
 * 解析某个工作区的历史目录：
 * - 目录名可读：`<别名或文件夹名>-<短哈希>`（例如 `手机逆向-3c7afcaf`）
 * - 旧版纯哈希目录会自动改名迁移
 * - 通过 `workspace.json` 认领：别名改了也能找到原历史并顺手改名
 */
async function resolveDir(root: string, historyDir: string, label?: string): Promise<string> {
  const readableBase = (label ?? "").trim() !== "" ? (label as string).trim() : path.basename(root) || "workspace";
  const readableName = `${sanitize(readableBase)}-${hashOf(root, 8)}`;
  const readableDir = path.join(historyDir, readableName);
  const legacyDir = path.join(historyDir, hashOf(root, 16));

  const adopt = async (dir: string): Promise<string> => {
    if (dir !== readableDir) {
      try {
        if (await isFile(indexPath(readableDir))) {
          // 目标已存在（罕见）：直接用目标
          await writeManifest(readableDir, root, label);
          return readableDir;
        }
        await rename(dir, readableDir);
        await writeManifest(readableDir, root, label);
        return readableDir;
      } catch {
        await writeManifest(dir, root, label);
        return dir;
      }
    }
    await writeManifest(dir, root, label);
    return dir;
  };

  if (await isFile(indexPath(readableDir))) {
    await writeManifest(readableDir, root, label);
    return readableDir;
  }

  if (await isFile(indexPath(legacyDir))) return adopt(legacyDir);

  for (const name of await subDirs(historyDir)) {
    const dir = path.join(historyDir, name);
    if (!(await isFile(indexPath(dir)))) continue;
    const manifest = await readJson<WorkspaceManifest>(path.join(dir, MANIFEST_FILE));
    if (manifest?.root === root) return adopt(dir);
  }

  await writeManifest(readableDir, root, label);
  return readableDir;
}

async function saveIndex(dir: string, index: SessionIndex): Promise<void> {
  await writeJson(indexPath(dir), index);
}

async function migrateFolderLayout(dir: string, index: SessionIndex, loose: (SessionMeta & { folder?: string })[]): Promise<void> {
  for (const session of loose) {
    if (typeof session.folder === "string" && session.folder !== "") continue;
    const folder = uniqueFolder(index.sessions, sanitize(session.title), session.id);
    const legacyFile = path.join(dir, `${session.id}.json`);
    const data = await readJson<MessagesFile>(legacyFile);
    if (data) {
      await writeJson(messagesPath(dir, folder), { messages: Array.isArray(data.messages) ? data.messages : [] });
      await rm(legacyFile, { force: true });
    }
    session.folder = folder;
  }
}

async function loadIndex(root: string, historyDir: string, label?: string): Promise<{ dir: string; index: SessionIndex }> {
  const dir = await resolveDir(root, historyDir, label);
  const raw = await readJson<LooseIndex>(indexPath(dir));

  if (raw && Array.isArray(raw.sessions) && raw.sessions.length > 0) {
    const index: SessionIndex = {
      active: raw.active ?? raw.sessions[0]?.id ?? "",
      sessions: raw.sessions.map((session) => ({ ...session, folder: session.folder ?? "" })),
    };
    if (raw.sessions.some((session) => !session.folder)) {
      await migrateFolderLayout(dir, index, raw.sessions);
    }
    if (!index.sessions.some((session) => session.id === index.active)) {
      index.active = index.sessions[0]?.id ?? "";
    }
    return { dir, index };
  }

  // 迁移最早的「单文件历史」：<historyDir>/<hash16>.json
  const legacyFile = path.join(historyDir, `${hashOf(root, 16)}.json`);
  const legacy = await readJson<{ messages?: StoredMessage[]; updatedAt?: string }>(legacyFile);
  const now = new Date().toISOString();
  const messages = Array.isArray(legacy?.messages) ? legacy.messages : [];
  const title = deriveTitle(messages) || "新对话1";
  const meta: SessionMeta = {
    id: newId(),
    title,
    folder: sanitize(title),
    createdAt: legacy?.updatedAt ?? now,
    updatedAt: legacy?.updatedAt ?? now,
  };
  const index: SessionIndex = { active: meta.id, sessions: [meta] };
  if (messages.length > 0) await writeJson(messagesPath(dir, meta.folder), { messages });
  await saveIndex(dir, index);
  if (legacy) await rm(legacyFile, { force: true });
  return { dir, index };
}

export async function listSessions(
  root: string,
  historyDir: string,
  label?: string,
): Promise<{ active: string; sessions: SessionMeta[] }> {
  const { index } = await loadIndex(root, historyDir, label);
  return { active: index.active, sessions: index.sessions };
}

export async function createSession(
  root: string,
  historyDir: string,
  title?: string,
  label?: string,
): Promise<{ active: string; sessions: SessionMeta[]; session: SessionMeta }> {
  const { dir, index } = await loadIndex(root, historyDir, label);
  const now = new Date().toISOString();
  const finalTitle = title?.trim() || nextTitle(index.sessions);
  const meta: SessionMeta = {
    id: newId(),
    title: finalTitle,
    folder: uniqueFolder(index.sessions, sanitize(finalTitle)),
    createdAt: now,
    updatedAt: now,
  };
  await writeJson(messagesPath(dir, meta.folder), { messages: [] });
  index.sessions = [meta, ...index.sessions];
  index.active = meta.id;
  await saveIndex(dir, index);
  return { active: index.active, sessions: index.sessions, session: meta };
}

export async function renameSession(
  root: string,
  historyDir: string,
  id: string,
  title: string,
  label?: string,
): Promise<{ active: string; sessions: SessionMeta[] }> {
  const { dir, index } = await loadIndex(root, historyDir, label);
  const session = index.sessions.find((entry) => entry.id === id);
  const clean = title.trim();
  if (!session || clean === "") return { active: index.active, sessions: index.sessions };

  const folder = uniqueFolder(index.sessions, sanitize(clean), id);
  if (folder !== session.folder) {
    const from = path.join(dir, session.folder);
    const to = path.join(dir, folder);
    try {
      await rename(from, to);
    } catch {
      await mkdir(to, { recursive: true });
    }
    session.folder = folder;
  }
  session.title = clean;
  session.updatedAt = new Date().toISOString();
  await saveIndex(dir, index);
  return { active: index.active, sessions: index.sessions };
}

export async function activateSession(
  root: string,
  historyDir: string,
  id: string,
  label?: string,
): Promise<{ active: string; sessions: SessionMeta[] }> {
  const { dir, index } = await loadIndex(root, historyDir, label);
  if (index.sessions.some((session) => session.id === id)) {
    index.active = id;
    await saveIndex(dir, index);
  }
  return { active: index.active, sessions: index.sessions };
}

export async function deleteSession(
  root: string,
  historyDir: string,
  id: string,
  label?: string,
): Promise<{ active: string; sessions: SessionMeta[] }> {
  const { dir, index } = await loadIndex(root, historyDir, label);
  const session = index.sessions.find((entry) => entry.id === id);
  if (session) await rm(path.join(dir, session.folder), { recursive: true, force: true });
  index.sessions = index.sessions.filter((entry) => entry.id !== id);

  if (index.sessions.length === 0) {
    const now = new Date().toISOString();
    const title = "新对话1";
    const meta: SessionMeta = { id: newId(), title, folder: sanitize(title), createdAt: now, updatedAt: now };
    await writeJson(messagesPath(dir, meta.folder), { messages: [] });
    index.sessions = [meta];
  }
  if (!index.sessions.some((entry) => entry.id === index.active)) {
    index.active = index.sessions[0]?.id ?? "";
  }
  await saveIndex(dir, index);
  return { active: index.active, sessions: index.sessions };
}

export async function readActive(
  root: string,
  historyDir: string,
  label?: string,
): Promise<{ session: SessionMeta | null; messages: StoredMessage[] }> {
  const { dir, index } = await loadIndex(root, historyDir, label);
  const session = index.sessions.find((entry) => entry.id === index.active) ?? null;
  if (!session) return { session: null, messages: [] };
  const data = await readJson<MessagesFile>(messagesPath(dir, session.folder));
  return { session, messages: Array.isArray(data?.messages) ? data.messages : [] };
}

export async function writeActive(
  root: string,
  historyDir: string,
  messages: StoredMessage[],
  label?: string,
): Promise<void> {
  const { dir, index } = await loadIndex(root, historyDir, label);
  const session = index.sessions.find((entry) => entry.id === index.active);
  if (!session) return;
  const trimmed = messages.slice(-200);
  session.updatedAt = new Date().toISOString();
  await writeJson(messagesPath(dir, session.folder), { messages: trimmed });
  await saveIndex(dir, index);
}
