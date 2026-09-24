import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolSpec } from "@myblog/agent";

/** 插件清单（plugin.json） */
export interface PluginManifest {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  /** 入口文件，默认 index.mjs */
  main?: string;
  /** 声明的权限（当前仅作说明，未强制） */
  permissions?: string[];
}

/** 传给插件回调的上下文 */
export interface PluginContext {
  /** 当前工作区根目录 */
  root: string;
  pluginId: string;
}

export interface PluginCommandDefinition {
  id: string;
  title: string;
  hint?: string;
  run: (ctx: PluginContext) => unknown | Promise<unknown>;
}

export interface PluginToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: PluginContext) => unknown | Promise<unknown>;
}

export interface PluginDefinition {
  commands?: PluginCommandDefinition[];
  tools?: PluginToolDefinition[];
  handlers?: Record<string, (payload: unknown, ctx: PluginContext) => unknown | Promise<unknown>>;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  commands: string[];
  tools: string[];
  handlers: string[];
  error?: string;
}

export interface LoadedCommand {
  id: string;
  title: string;
  hint: string;
  pluginId: string;
  run: (ctx: PluginContext) => unknown | Promise<unknown>;
}

export interface LoadedTool {
  name: string;
  pluginId: string;
  spec: ToolSpec;
  run: (args: Record<string, unknown>, ctx: PluginContext) => unknown | Promise<unknown>;
}

export interface LoadedHandler {
  pluginId: string;
  run: (payload: unknown, ctx: PluginContext) => unknown | Promise<unknown>;
}

export interface LoadedPlugins {
  plugins: PluginInfo[];
  commands: LoadedCommand[];
  tools: LoadedTool[];
  handlers: Record<string, LoadedHandler>;
}

export const EMPTY_PLUGINS: LoadedPlugins = { plugins: [], commands: [], tools: [], handlers: {} };

function asDefinition(value: unknown): PluginDefinition {
  return value && typeof value === "object" ? (value as PluginDefinition) : {};
}

/** 扫描插件目录（每个子目录一个插件，含 plugin.json），动态加载入口 */
export async function loadPlugins(dir?: string): Promise<LoadedPlugins> {
  const result: LoadedPlugins = { plugins: [], commands: [], tools: [], handlers: {} };
  if (!dir) return result;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(dir, entry.name);

    let manifest: PluginManifest;
    try {
      manifest = JSON.parse(await readFile(path.join(dirPath, "plugin.json"), "utf8")) as PluginManifest;
    } catch {
      continue;
    }

    const id = typeof manifest.id === "string" && manifest.id.trim() !== "" ? manifest.id.trim() : entry.name;
    const info: PluginInfo = {
      id,
      name: manifest.name ?? id,
      version: manifest.version ?? "",
      description: manifest.description ?? "",
      commands: [],
      tools: [],
      handlers: [],
    };

    try {
      const main = manifest.main ?? "index.mjs";
      const module = (await import(pathToFileURL(path.join(dirPath, main)).href)) as { default?: unknown };
      const plugin = asDefinition(module.default);

      for (const command of plugin.commands ?? []) {
        if (!command || typeof command.id !== "string" || typeof command.run !== "function") continue;
        const fullId = `${id}.${command.id}`;
        result.commands.push({
          id: fullId,
          title: command.title ?? command.id,
          hint: command.hint ?? "",
          pluginId: id,
          run: command.run,
        });
        info.commands.push(fullId);
      }

      for (const tool of plugin.tools ?? []) {
        if (!tool || typeof tool.name !== "string" || typeof tool.run !== "function") continue;
        const spec: ToolSpec = {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description ?? tool.name,
            parameters: tool.parameters ?? { type: "object", properties: {}, additionalProperties: false },
          },
        };
        result.tools.push({ name: tool.name, pluginId: id, spec, run: tool.run });
        info.tools.push(tool.name);
      }

      for (const [name, run] of Object.entries(plugin.handlers ?? {})) {
        if (typeof run !== "function" || result.handlers[name]) continue;
        result.handlers[name] = { pluginId: id, run };
        info.handlers.push(name);
      }
    } catch (error) {
      info.error = error instanceof Error ? error.message : String(error);
    }

    result.plugins.push(info);
  }

  return result;
}
