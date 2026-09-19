// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, () => void>();
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }
  close(): void {}
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeEventSource.instances = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/status")) return json(status);
      if (url.includes("/api/today")) return json(today);
      if (url.includes("/api/check")) return json(check);
      if (url.includes("/api/chat/history")) return json({ messages: [] });
      if (url.includes("/api/agent")) return json({ configured: false, baseURL: "", model: "", hasApiKey: false, configPath: "" });
      if (url.includes("/api/summaries")) return json(summaries);
      return json({});
    }),
  );
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
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

    expect(container.textContent).toContain("今天该干什么");
    expect(container.querySelector("strong")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
