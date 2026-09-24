// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App.js";
import { ToastProvider } from "../src/hooks/useToasts.js";

const status = {
  root: "D:/sample",
  version: "0.0.0",
  stage: "**G3**：Hook",
  stageIds: ["G3"],
  capabilities: [
    { id: "G1", name: "环境", question: "adb 能用", status: "已通", active: false },
    { id: "G3", name: "Hook", question: "Frida 改返回值", status: "未开始", active: true },
  ],
  progress: {
    learned: "**G1** 通了",
    next: "写 `hook.js` [昨天](./2026-09-17/总结.md)",
    latest: "[2026-09-17](./2026-09-17/总结.md)",
  },
  records: [
    { date: "2026-09-17", didWhat: "装包读到 **DENIED**", link: "./2026-09-17/总结.md", linkText: "总结" },
  ],
  directions: ["**G1 环境**"],
};

const today = {
  stage: status.stage,
  stageIds: ["G3"],
  active: status.capabilities.filter((capability) => capability.active),
  next: "写 `hook.js`",
  lastDate: "2026-09-17",
  lastNext: "1. 起 server",
  lastSkills: ["G2"],
  missing: [],
};

const check = { ok: true, issues: [] };

const summaries = [
  {
    path: "2026-09-17/总结.md",
    raw: "# 2026-09-17\n\n## 这次\n\n能力：G2\n",
    date: "2026-09-17",
    preview: "上次到 G1",
    thisTime: "能力：G2",
    skills: ["G2"],
    next: "1. 起 server",
  },
];

function stubBridge(): void {
  const responses: Record<string, unknown> = {
    status,
    today,
    check,
    summaries,
    sessions: { active: "", sessions: [] },
    history: { session: null, messages: [] },
    agent: { configured: false, baseURL: "", model: "", hasApiKey: false, configPath: "" },
    workspaces: { active: status.root, list: [status.root] },
    git: { isRepo: false, branch: "", dirty: 0, lastCommit: "", suggested: "" },
    search: { query: "", hits: [] },
    plugins: { plugins: [], commands: [] },
  };

  (window as { myblog?: unknown }).myblog = {
    desktop: true,
    api: {
      invoke: async (method: string) => responses[method] ?? {},
      chat: async () => {},
      cancelChat: () => {},
      onChatEvent: () => () => {},
      onFsChange: () => () => {},
    },
  };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  stubBridge();
});

afterEach(() => {
  delete (window as { myblog?: unknown }).myblog;
});

describe("App", () => {
  it("mounts, fetches and renders markdown without crashing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <ToastProvider>
          <App />
        </ToastProvider>,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("今日学习");
    expect(container.querySelector("strong")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
