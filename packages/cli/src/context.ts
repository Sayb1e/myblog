import path from "node:path";
import { Workspace } from "@myblog/core";
import type { Command } from "commander";

export function rootOf(program: Command): string {
  const options = program.opts<{ root?: string }>();
  return path.resolve(options.root ?? process.env.MYBLOG_ROOT ?? process.cwd());
}

export async function openWorkspace(program: Command): Promise<Workspace> {
  return Workspace.load(rootOf(program));
}

export function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
