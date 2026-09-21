import { useCallback, useEffect, useRef, useState } from "react";
import {
  activateSession,
  createSession,
  deleteSession,
  errorMessage,
  getAgentConfig,
  getChatHistory,
  getSessions,
  renameSession,
  saveAgentConfig,
  saveChatHistory,
  streamChat,
  type AgentConfigView,
  type ChatEvent,
  type ChatMessageRecord,
  type SessionMeta,
} from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { IconArrowDown, IconPencil, IconPlus, IconSpark, IconTrash } from "./icons.js";
import { Markdown } from "./Markdown.js";
import { Select } from "./Select.js";
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

function DiffView({ lines }: { lines: string[] }) {
  return (
    <div className="tool-diff">
      {lines.map((line, index) => (
        <div
          key={index}
          className={
            line.startsWith("+") ? "diff-add" : line.startsWith("-") ? "diff-del" : "diff-ctx"
          }
        >
          {line || " "}
        </div>
      ))}
    </div>
  );
}

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
          <DiffView lines={diff} />
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

function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => undefined);
      }}
    >
      {copied ? "已复制" : label}
    </button>
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
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeSession, setActiveSession] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id ?? -1;

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

  const loadActive = useCallback(async (): Promise<void> => {
    const stored = await getChatHistory();
    const list = Array.isArray(stored.messages) ? stored.messages : [];
    const restored: Message[] = list.map((message) => ({
      ...message,
      tools: message.tools.map((tool) => ({ ...tool, pending: false })),
    }));
    setMessages(restored);
    nextId = Math.max(nextId, ...restored.map((message) => message.id + 1));
    if (stored.session) setActiveSession(stored.session.id);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await getSessions();
        setSessions(list.sessions);
        setActiveSession(list.active);
        await loadActive();
      } catch (caught) {
        toast("error", errorMessage(caught));
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, [toast, loadActive]);

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

  const onScroll = (): void => {
    const element = bodyRef.current;
    if (!element) return;
    setAtBottom(element.scrollHeight - element.scrollTop - element.clientHeight < 48);
  };

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

  const newSession = async (): Promise<void> => {
    try {
      const list = await createSession();
      setSessions(list.sessions);
      setActiveSession(list.active);
      setMessages([]);
      nextId = 1;
      toast("info", "已新建会话");
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const switchSession = async (id: string): Promise<void> => {
    if (id === activeSession) return;
    try {
      const list = await activateSession(id);
      setSessions(list.sessions);
      setActiveSession(list.active);
      await loadActive();
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const removeSession = async (): Promise<void> => {
    setConfirmDelete(false);
    try {
      const list = await deleteSession(activeSession);
      setSessions(list.sessions);
      setActiveSession(list.active);
      await loadActive();
      toast("info", "已删除会话");
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const openRename = (): void => {
    const current = sessions.find((session) => session.id === activeSession);
    setRenameValue(current?.title ?? "");
    setRenameOpen(true);
  };

  const submitRename = async (): Promise<void> => {
    const value = renameValue.trim();
    if (value === "") return;
    try {
      const list = await renameSession(activeSession, value);
      setSessions(list.sessions);
      setRenameOpen(false);
      toast("success", "已重命名");
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const runTurn = async (
    history: { role: "user" | "assistant"; content: string }[],
    assistantId: number,
  ): Promise<void> => {
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
    await runTurn(history, assistantId);
  };

  const regenerate = async (assistantId: number): Promise<void> => {
    if (streaming) return;
    const index = messages.findIndex((message) => message.id === assistantId);
    if (index < 1) return;
    const base = messages.slice(0, index);
    const history = base.map((message) => ({ role: message.role, content: message.content }));
    const newId = nextId++;
    setMessages([...base, { id: newId, role: "assistant", content: "", tools: [] }]);
    await runTurn(history, newId);
  };

  const editUser = (message: Message): void => {
    if (streaming) return;
    setMessages((current) => current.slice(0, current.findIndex((item) => item.id === message.id)));
    setInput(message.content);
  };

  const exportChat = (): void => {
    const markdown = messages
      .map((message) => `## ${message.role === "user" ? "我" : "助手"}\n\n${message.content}`)
      .join("\n\n");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `myblog-chat-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
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
          <Select
            value={activeSession}
            options={sessions.map((session) => ({ value: session.id, label: session.title }))}
            onChange={(id) => void switchSession(id)}
            placeholder="会话"
            action={{ label: "新建会话", icon: <IconPlus />, onSelect: () => void newSession() }}
          />
          <button type="button" className="icon-btn sm" onClick={openRename} title="重命名会话">
            <IconPencil />
          </button>
          <button
            type="button"
            className="icon-btn sm"
            onClick={() => setConfirmDelete(true)}
            title="删除当前会话"
            disabled={sessions.length <= 1}
          >
            <IconTrash />
          </button>
          <button type="button" onClick={exportChat} disabled={messages.length === 0}>
            导出
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
            <Select
              value=""
              placeholder="选择服务商，自动填 Base URL / Model…"
              options={[
                { value: "", label: "选择服务商，自动填 Base URL / Model…" },
                ...PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
              ]}
              onChange={(id) => {
                const preset = PRESETS.find((item) => item.id === id);
                if (!preset || preset.id === "custom") return;
                setBaseURL(preset.baseURL);
                setModel(preset.model);
              }}
            />
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

      <div className="chat-body" ref={bodyRef} onScroll={onScroll}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-mark">
              <IconSpark />
            </div>
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
          const isLastAssistant = message.role === "assistant" && message.id === lastAssistantId;
          return (
            <div key={message.id} className={`msg ${message.role}`}>
              <div className={`bubble ${message.role}`}>
                {thinking && <Spinner label="思考中" />}
                {message.content &&
                  (message.role === "user" ? (
                    <div className="user-text">{message.content}</div>
                  ) : (
                    <Markdown>{message.content}</Markdown>
                  ))}
                {message.tools.length > 1 ? (
                  <details className="tool-group" open>
                    <summary>工具调用 {message.tools.length} 次</summary>
                    <div className="tool-list">
                      {message.tools.map((tool, index) => (
                        <ToolCardView key={index} tool={tool} />
                      ))}
                    </div>
                  </details>
                ) : (
                  message.tools.length === 1 && (
                    <div className="tool-list">
                      <ToolCardView tool={message.tools[0] as ToolCard} />
                    </div>
                  )
                )}
              </div>

              <div className="msg-actions">
                {message.role === "assistant" && message.content && (
                  <>
                    <CopyButton text={message.content} />
                    {isLastAssistant && !streaming && (
                      <button type="button" className="copy-btn" onClick={() => void regenerate(message.id)}>
                        重新生成
                      </button>
                    )}
                  </>
                )}
                {message.role === "user" && !streaming && (
                  <button type="button" className="copy-btn" onClick={() => editUser(message)}>
                    编辑
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!atBottom && (
        <button type="button" className="scroll-bottom" onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}>
          <IconArrowDown /> 到底部
        </button>
      )}

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

      {renameOpen && (
        <div className="palette-overlay" onClick={() => setRenameOpen(false)}>
          <div className="palette dialog" onClick={(event) => event.stopPropagation()}>
            <div className="palette-input">
              <strong>重命名会话</strong>
            </div>
            <div className="dialog-body">
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitRename();
                  if (event.key === "Escape") setRenameOpen(false);
                }}
              />
              <div className="row">
                <button type="button" className="primary" onClick={() => void submitRename()}>
                  确定
                </button>
                <button type="button" onClick={() => setRenameOpen(false)}>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="palette-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="palette dialog" onClick={(event) => event.stopPropagation()}>
            <div className="palette-input">
              <strong>删除会话</strong>
            </div>
            <div className="dialog-body">
              <p className="muted">删除后不可撤销，确定要删除当前会话吗？</p>
              <div className="row">
                <button type="button" className="primary danger" onClick={() => void removeSession()}>
                  删除
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
