import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATES_DIR = fileURLToPath(new URL("../templates", import.meta.url));

export const AGENT_NAMES = ["opencode", "claude", "cursor", "agents"] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

const COMMANDS = [
  { name: "today", description: "读取学习工作区状态，给出今天的任务建议（只读，不改文件）" },
  { name: "close", description: "收尾当天学习：生成当日总结并幂等写回总览（先 dry-run 再落盘）" },
] as const;

const SKILL_NAME = "learning-loop";
const BLOCK_START = "<!-- myblog:start -->";
const BLOCK_END = "<!-- myblog:end -->";

interface AgentLayout {
  commandsDir: string;
  skillDir?: string;
  frontmatter: (description: string) => string[];
}

const LAYOUTS: Record<Exclude<AgentName, "agents">, AgentLayout> = {
  opencode: {
    commandsDir: ".opencode/command",
    skillDir: ".opencode/skills",
    frontmatter: (description) => [`description: ${quote(description)}`, "agent: build"],
  },
  claude: {
    commandsDir: ".claude/commands",
    skillDir: ".claude/skills",
    frontmatter: (description) => [`description: ${quote(description)}`],
  },
  cursor: {
    commandsDir: ".cursor/commands",
    frontmatter: (description) => [`description: ${quote(description)}`],
  },
};

export interface InitOptions {
  root: string;
  agents: AgentName[];
  force?: boolean;
}

export interface InitResult {
  written: string[];
  skipped: string[];
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function relative(root: string, target: string): string {
  return path.relative(root, target) || target;
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export function parseAgents(input: string): AgentName[] {
  const requested = input.split(/[\s,]+/).filter((value) => value !== "");
  const names = requested.includes("all") ? [...AGENT_NAMES] : requested;
  const unknown = names.filter((name) => !(AGENT_NAMES as readonly string[]).includes(name));
  if (unknown.length > 0) {
    throw new Error(`未知 agent：${unknown.join(", ")}（可用：${AGENT_NAMES.join(", ")}, all）`);
  }
  return [...new Set(names as AgentName[])];
}

function withFrontmatter(fields: string[], body: string): string {
  return ["---", ...fields, "---", "", body.replace(/\s*$/, ""), ""].join("\n");
}

async function writeFileOrSkip(
  target: string,
  content: string,
  force: boolean,
  root: string,
  result: InitResult,
): Promise<void> {
  if (!force && (await exists(target))) {
    result.skipped.push(relative(root, target));
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  result.written.push(relative(root, target));
}

async function upsertBlock(target: string, block: string): Promise<boolean> {
  let existing = "";
  try {
    existing = await readFile(target, "utf8");
  } catch {
    existing = "";
  }

  const wrapped = `${BLOCK_START}\n${block.replace(/\s*$/, "")}\n${BLOCK_END}`;
  const start = existing.indexOf(BLOCK_START);
  const end = existing.indexOf(BLOCK_END);

  let next: string;
  if (start !== -1 && end !== -1 && end > start) {
    next = existing.slice(0, start) + wrapped + existing.slice(end + BLOCK_END.length);
  } else if (existing.trim() === "") {
    next = `${wrapped}\n`;
  } else {
    next = `${existing.replace(/\s*$/, "")}\n\n${wrapped}\n`;
  }

  if (next === existing) return false;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, next, "utf8");
  return true;
}

async function ensureOpencodeConfig(root: string, result: InitResult): Promise<void> {
  const target = path.join(root, ".opencode", "opencode.json");
  let config: Record<string, unknown> = {};

  try {
    config = JSON.parse(await readFile(target, "utf8")) as Record<string, unknown>;
  } catch {
    config = {};
  }

  const mcp = (config.mcp as Record<string, unknown> | undefined) ?? {};
  if (mcp.myblog) {
    result.skipped.push(relative(root, target));
    return;
  }

  if (config.$schema === undefined) config.$schema = "https://opencode.ai/config.json";
  config.mcp = { ...mcp, myblog: { type: "local", command: ["myblog", "mcp"], enabled: true } };

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  result.written.push(relative(root, target));
}

export async function initWorkspace(options: InitOptions): Promise<InitResult> {
  const result: InitResult = { written: [], skipped: [] };
  const force = options.force === true;
  const agents = options.agents;
  const needsCommands = agents.some((agent) => agent !== "agents");

  const commandBodies = new Map<string, string>();
  if (needsCommands) {
    for (const command of COMMANDS) {
      commandBodies.set(command.name, await readFile(path.join(TEMPLATES_DIR, "commands", `${command.name}.md`), "utf8"));
    }
  }

  let skillBody: string | null = null;
  if (agents.includes("opencode") || agents.includes("claude")) {
    skillBody = await readFile(path.join(TEMPLATES_DIR, "skills", SKILL_NAME, "SKILL.md"), "utf8");
  }

  for (const agent of agents) {
    if (agent === "agents") {
      const block = await readFile(path.join(TEMPLATES_DIR, "agents-block.md"), "utf8");
      const target = path.join(options.root, "AGENTS.md");
      const changed = await upsertBlock(target, block);
      (changed ? result.written : result.skipped).push(relative(options.root, target));
      continue;
    }

    const layout = LAYOUTS[agent];
    for (const command of COMMANDS) {
      const body = commandBodies.get(command.name) ?? "";
      const content = withFrontmatter(layout.frontmatter(command.description), body);
      const target = path.join(options.root, layout.commandsDir, `${command.name}.md`);
      await writeFileOrSkip(target, content, force, options.root, result);
    }

    if (layout.skillDir && skillBody !== null) {
      const target = path.join(options.root, layout.skillDir, SKILL_NAME, "SKILL.md");
      await writeFileOrSkip(target, skillBody, force, options.root, result);
    }

    if (agent === "opencode") {
      await ensureOpencodeConfig(options.root, result);
    }
  }

  return result;
}
