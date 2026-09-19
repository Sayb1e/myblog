import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearChatHistory,
  errorMessage,
  getAgentConfig,
  getChatHistory,
  saveAgentConfig,
  saveChatHistory,
  streamChat,
  type AgentConfigView,
  type ChatEvent,
  type ChatMessageRecord,
} from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { Markdown } from "./Markdown.js";
import { Spinner } from "./Spinner.js";

interface ToolCard {
  name: string;
  args: string;
  result: unknown;
  pending?: boolean;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  tools: ToolCard[];
}

const PRESETS: { id: string; label: string; baseURL: string; model: string }[] = [
  { id: "openai", label: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "deepseek", label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { id: "dashscope", label: "通义千问", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { id: "moonshot", label: "Kimi / Moonshot", baseURL: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  { id: "zhipu", label: "智谱 GLM", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { id: "openrouter", label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  { id: "ollama", label: "本地 Ollama", baseURL: "http://127.0.0.1:11434/v1", model: "qwen2.5" },
  { id: "custom", label: "自定义", baseURL: "", model: "" },
];

const TOOL_META: Record<string, { label: string; icon: string; write?: boolean }> = {
  myblog_context: { label: "读取工作区", icon: "◈" },
  myblog_check: { label: "校验工作区", icon: "✓" },
  myblog_read_summary: { label: "读取每日总结", icon: "▤" },
  myblog_scaffold: { label: "创建当日总结", icon: "＋", write: true },
  myblog_close: { label: "写回总览", icon: "↩", write: true },
};

const SUGGESTIONS = ["今天学什么？", "帮我收工写回", "校验一下工作区"];

let nextId = 1;

function ToolCardView({ tool }: { tool: ToolCard }) {
  const meta = TOOL_META[tool.name] ?? { label: tool.name, icon: "⚙" as const };
  const result = (tool.result ?? {}) as Record<string, unknown>;
  const diff = Array.isArray(result.diff) ? (result.diff as string[]) : null;
  const error = typeof result.error === "string" ? result.error : null;
  const isPreview = diff !== null && result.dryRun !== false;

  let argDate = "";
  try {
    const parsed = JSON.parse(tool.args || "{}") as { date?: unknown };
    if (typeof parsed.date === "string") argDate = parsed.date;
  } catch {
    argDate = "";
  }

  const state = error ? "出错" : isPreview ? "待确认" : "完成";

  return (
    <div className={`tool${meta.write ? " write" : ""}${tool.pending ? " pending" : ""}`}>
      <div className="tool-line">
        <span className="tool-icon">{meta.icon}</span>
        <span className="tool-label">{meta.label}</span>
        {argDate && <span className="tool-arg">{argDate}</span>}
        <span className="tool-state">{tool.pending ? <Spinner label="执行中" /> : state}</span>
      </div>
      {error && <p className="tool-error">{error}</p>}
      {diff && diff.length > 0 && (
        <details className="tool-details" open={isPreview}>
          <summary>{isPreview ? "改动预览（确认后才会写入）" : "改动"}</summary>
          <pre className="tool-diff">{diff.join("\n")}</pre>
        </details>
      )}
      {!diff && !error && !tool.pending && (
        <details className="tool-details">
          <summary>查看结果</summary>
          <pre>{JSON.stringify(tool.result, null, 2).slice(0, 4000)}</pre>
        </details>
      )}
    </div>
  );
}

export function ChatView() {
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [config, setConfig] = useState<AgentConfigView | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [baseURL, setBaseURL] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const next = await getAgentConfig();
      setConfig(next);
      setBaseURL(next.baseURL);
      setModel(next.model);
      if (!next.configured) setSettingsOpen(true);
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  }, [toast]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await getChatHistory();
        const list = Array.isArray(stored.messages) ? stored.messages : [];
        const restored: Message[] = list.map((message) => ({
          ...message,
          tools: message.tools.map((tool) => ({ ...tool, pending: false })),
        }));
        setMessages(restored);
        nextId = Math.max(nextId, ...restored.map((message) => message.id + 1));
      } catch (caught) {
        toast("error", errorMessage(caught));
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (!historyLoaded) return;
    const timer = window.setTimeout(() => {
      void saveChatHistory(messages).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [messages, historyLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const saveSettings = async (): Promise<void> => {
    try {
      const next = await saveAgentConfig({ baseURL, model, ...(apiKey ? { apiKey } : {}) });
      setConfig(next);
      setApiKey("");
      setSettingsOpen(false);
      toast("success", "模型配置已保存");
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const reset = async (): Promise<void> => {
    try {
      await clearChatHistory();
      setMessages([]);
      nextId = 1;
      toast("info", "已开始新对话");
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const send = async (override?: string): Promise<void> => {
    const text = (override ?? input).trim();
    if (!text || streaming) return;

    const userMessage: Message = { id: nextId++, role: "user", content: text, tools: [] };
    const assistantId = nextId++;
    const history = [...messages, userMessage].map((message) => ({ role: message.role, content: message.content }));

    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", content: "", tools: [] },
    ]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        history,
        (event: ChatEvent) => {
          setMessages((current) =>
            current.map((message) => {
              if (message.id !== assistantId) return message;
              if (event.type === "text") return { ...message, content: message.content + event.text };
              if (event.type === "tool_start") {
                return {
                  ...message,
                  tools: [...message.tools, { name: event.name, args: event.args, result: undefined, pending: true }],
                };
              }
              if (event.type === "tool") {
                const index = [...message.tools]
                  .map((tool, i) => ({ tool, i }))
                  .reverse()
                  .find((entry) => entry.tool.name === event.name && entry.tool.pending)?.i;
                if (index === undefined) {
                  return {
                    ...message,
                    tools: [...message.tools, { name: event.name, args: event.args, result: event.result }],
                  };
                }
                const tools = message.tools.slice();
                tools[index] = { name: event.name, args: event.args, result: event.result, pending: false };
                return { ...message, tools };
              }
              if (event.type === "error") {
                return { ...message, content: `${message.content}\n\n> 错误：${event.message}` };
              }
              return message;
            }),
          );
        },
        controller.signal,
      );
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") toast("error", errorMessage(caught));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="chat">
      <div className="chat-head">
        <div className="chat-model">
          <span className="chat-model-name">
            <span className={`model-dot ${config?.configured ? "on" : "off"}`} />
            {config?.configured ? config.model : "未配置模型"}
          </span>
          <span className="muted">{config?.configured ? config.baseURL : "在设置里填 baseURL / model / key"}</span>
        </div>
        <div className="chat-actions">
          <button type="button" onClick={() => void reset()}>
            新对话
          </button>
          <button type="button" onClick={() => setSettingsOpen((open) => !open)}>
            设置
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="card chat-settings">
          <label>
            服务商预设
            <select
              value=""
              onChange={(event) => {
                const preset = PRESETS.find((item) => item.id === event.target.value);
                if (!preset || preset.id === "custom") return;
                setBaseURL(preset.baseURL);
                setModel(preset.model);
              }}
            >
              <option value="">选择服务商，自动填 Base URL / Model…</option>
              {PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Base URL
            <input value={baseURL} onChange={(event) => setBaseURL(event.target.value)} placeholder="https://api.deepseek.com/v1" />
          </label>
          <label>
            Model
            <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="deepseek-chat" />
          </label>
          <label>
            API Key
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={config?.hasApiKey ? "已保存，留空则不改" : "sk-..."}
            />
          </label>
          <div className="row">
            <button type="button" className="primary" onClick={() => void saveSettings()}>
              保存
            </button>
            <span className="muted">Key 只存在本地，不会下发到页面。</span>
          </div>
          {config && <p className="muted">配置文件：{config.configPath}</p>}
        </div>
      )}

      <div className="chat-body">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-mark">✦</div>
            <p>问它「今天学什么」，它会读你的真实进度来规划；写回前会先给你看 diff。</p>
            <div className="suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => void send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const thinking = message.role === "assistant" && message.content === "" && message.tools.length === 0 && streaming;
          return (
            <div key={message.id} className={`bubble ${message.role}`}>
              {thinking && <Spinner label="思考中" />}
              {message.content &&
                (message.role === "user" ? (
                  <div className="user-text">{message.content}</div>
                ) : (
                  <Markdown>{message.content}</Markdown>
                ))}
              {message.tools.length > 0 && (
                <div className="tool-list">
                  {message.tools.map((tool, index) => (
                    <ToolCardView key={index} tool={tool} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={input}
          placeholder="今天学什么？（Enter 发送，Shift+Enter 换行）"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        {streaming ? (
          <button type="button" onClick={() => abortRef.current?.abort()}>
            停止
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => void send()} disabled={!input.trim()}>
            发送
          </button>
        )}
      </div>
    </div>
  );
}
