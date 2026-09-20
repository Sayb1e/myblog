import { useEffect, useState } from "react";
import { errorMessage, getStorage, saveStorage, type StorageView } from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { usePrefs, type Prefs, type StylePref, type ThemePref } from "../prefs.js";

interface Props {
  root: string;
  version: string;
}

type CategoryId = "ui" | "features" | "storage" | "about";

const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: "ui", label: "界面", icon: "◨" },
  { id: "features", label: "功能", icon: "⚙" },
  { id: "storage", label: "存储", icon: "▤" },
  { id: "about", label: "关于", icon: "ⓘ" },
];

type BooleanPrefKey = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];

function Toggle({ prefKey, label, hint }: { prefKey: BooleanPrefKey; label: string; hint: string }) {
  const { prefs, setPref } = usePrefs();
  return (
    <label className="setting-row">
      <span>
        <strong>{label}</strong>
        <p className="muted">{hint}</p>
      </span>
      <input
        type="checkbox"
        className="switch"
        checked={prefs[prefKey]}
        onChange={(event) => setPref(prefKey, event.target.checked)}
      />
    </label>
  );
}

export function SettingsView({ root, version }: Props) {
  const [category, setCategory] = useState<CategoryId>("ui");
  const { prefs, setPref } = usePrefs();
  const toast = useToast();
  const [storage, setStorage] = useState<StorageView | null>(null);
  const [agentPath, setAgentPath] = useState("");
  const [historyPath, setHistoryPath] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const next = await getStorage();
        setStorage(next);
        setAgentPath(next.agentConfigPath);
        setHistoryPath(next.historyDir);
      } catch (caught) {
        toast("error", errorMessage(caught));
      }
    })();
  }, [toast]);

  const canPick = typeof window !== "undefined" && Boolean(window.myblog?.pickDirectory);

  const pickInto = async (apply: (value: string) => void): Promise<void> => {
    const picked = await window.myblog?.pickDirectory?.();
    if (picked) apply(picked);
  };

  const savePaths = async (): Promise<void> => {
    try {
      const next = await saveStorage({ agentConfigPath: agentPath, historyDir: historyPath });
      setStorage(next);
      setAgentPath(next.agentConfigPath);
      setHistoryPath(next.historyDir);
      toast("success", "存储位置已保存");
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  return (
    <div className="settings">
      <nav className="settings-nav">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`settings-tab${category === item.id ? " active" : ""}`}
            onClick={() => setCategory(item.id)}
          >
            <span className="settings-tab-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <section className="card settings-panel">
        {category === "ui" && (
          <>
            <div className="card-head">
              <h2>界面</h2>
            </div>
            <label className="setting-row">
              <span>
                <strong>主题</strong>
                <p className="muted">深色 / 浅色 / 跟随系统。</p>
              </span>
              <select
                className="setting-select"
                value={prefs.theme}
                onChange={(event) => setPref("theme", event.target.value as ThemePref)}
              >
                <option value="system">跟随系统</option>
                <option value="dark">深色</option>
                <option value="light">浅色</option>
              </select>
            </label>
            <label className="setting-row">
              <span>
                <strong>界面风格</strong>
                <p className="muted">产品风：渐变光晕、玻璃卡片、大标题、留白更松；原生风：紧凑的工具型外观。</p>
              </span>
              <select
                className="setting-select"
                value={prefs.style}
                onChange={(event) => setPref("style", event.target.value as StylePref)}
              >
                <option value="product">产品</option>
                <option value="native">原生</option>
              </select>
            </label>
            <Toggle prefKey="animations" label="动画效果" hint="思考中的 spinner 与界面过渡动画；关闭后更省电、更安静。" />
            <Toggle prefKey="codeHighlight" label="代码高亮" hint="对话里的代码块语法着色；关闭后以纯文本代码块显示。" />
            <Toggle prefKey="compact" label="紧凑模式" hint="减小间距与留白，一屏看到更多内容。" />
          </>
        )}

        {category === "features" && (
          <>
            <div className="card-head">
              <h2>功能</h2>
            </div>
            <Toggle
              prefKey="chatEnabled"
              label="内置对话"
              hint="关闭后隐藏「对话」入口，也不再加载模型配置与历史；仍可用「终端」里的 opencode / claude / codex。"
            />
            <Toggle
              prefKey="terminalEnabled"
              label="终端入口"
              hint="显示「终端」页（仅桌面端可用）；关闭则隐藏入口。"
            />
            <Toggle
              prefKey="liveRefresh"
              label="实时同步"
              hint="监听工作区文件变化并自动刷新界面；关闭后只能手动刷新。"
            />
          </>
        )}

        {category === "storage" && (
          <>
            <div className="card-head">
              <h2>存储</h2>
            </div>
            <div className="setting-field">
              <strong>模型配置文件</strong>
              <p className="muted">对话使用的 provider / key 配置（agent.json）。改到别处后，旧文件不会被自动搬移。</p>
              <div className="path-input">
                <input value={agentPath} onChange={(event) => setAgentPath(event.target.value)} spellCheck={false} />
                {canPick && (
                  <button type="button" onClick={() => void pickInto(setAgentPath)}>
                    浏览…
                  </button>
                )}
              </div>
            </div>
            <div className="setting-field">
              <strong>对话历史目录</strong>
              <p className="muted">按工作区在该目录下各存一个 JSON 文件。</p>
              <div className="path-input">
                <input value={historyPath} onChange={(event) => setHistoryPath(event.target.value)} spellCheck={false} />
                {canPick && (
                  <button type="button" onClick={() => void pickInto(setHistoryPath)}>
                    浏览…
                  </button>
                )}
              </div>
            </div>
            <div className="row">
              <button type="button" className="primary" onClick={() => void savePaths()}>
                保存
              </button>
              {storage && (
                <button
                  type="button"
                  onClick={() => {
                    setAgentPath(storage.defaults.agentConfigPath);
                    setHistoryPath(storage.defaults.historyDir);
                  }}
                >
                  恢复默认值
                </button>
              )}
              <span className="muted">这些设置存在本地（仓库外），不会写进学习仓，也不会提交到 git。</span>
            </div>
          </>
        )}

        {category === "about" && (
          <>
            <div className="card-head">
              <h2>关于</h2>
            </div>
            <div className="setting-row">
              <span>
                <strong>版本</strong>
                <p className="muted">MyBlog {version || "—"}</p>
              </span>
            </div>
            <div className="setting-row">
              <span>
                <strong>当前工作区</strong>
                <p className="muted">{root || "—"}</p>
              </span>
            </div>
            <div className="setting-row">
              <span>
                <strong>数据存放</strong>
                <p className="muted">
                  模型配置存本地 <code>agent.json</code>；对话历史按工作区存放（<code>history/</code>）。两者都不写入学习仓的 markdown。
                </p>
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
