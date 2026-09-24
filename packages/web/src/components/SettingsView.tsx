import { useEffect, useState, type ReactNode } from "react";
import { errorMessage, getPlugins, getStorage, saveStorage, type PluginInfo, type StorageView } from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { usePrefs, type AccentPref, type FontPref, type Prefs, type StylePref, type ThemePref } from "../prefs.js";
import { IconFolder, IconInfo, IconMoon, IconPuzzle, IconSettings, IconSliders, IconSun } from "./icons.js";

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#ffffff" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="#11151c" />
    </svg>
  );
}

interface Props {
  root: string;
  version: string;
}

type CategoryId = "ui" | "features" | "plugins" | "storage" | "about";

const CATEGORIES: { id: CategoryId; label: string; icon: ReactNode }[] = [
  { id: "ui", label: "界面", icon: <IconSliders /> },
  { id: "features", label: "功能", icon: <IconSettings /> },
  { id: "plugins", label: "插件", icon: <IconPuzzle /> },
  { id: "storage", label: "存储", icon: <IconFolder /> },
  { id: "about", label: "关于", icon: <IconInfo /> },
];

type BooleanPrefKey = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];

const FONT_OPTIONS: { id: FontPref; label: string }[] = [
  { id: "sm", label: "小" },
  { id: "md", label: "中" },
  { id: "lg", label: "大" },
];

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
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);

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

  useEffect(() => {
    void getPlugins()
      .then((view) => setPlugins(Array.isArray(view?.plugins) ? view.plugins : []))
      .catch(() => undefined);
  }, []);

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
            <div className="setting-field">
              <strong>主题</strong>
              <div className="theme-picker">
                {(
                  [
                    { id: "system", label: "跟随系统", icon: <SystemIcon /> },
                    { id: "dark", label: "深色", icon: <IconMoon /> },
                    { id: "light", label: "浅色", icon: <IconSun /> },
                  ] as { id: ThemePref; label: string; icon: ReturnType<typeof IconSun> }[]
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`theme-tile${prefs.theme === option.id ? " active" : ""}`}
                    onClick={() => setPref("theme", option.id)}
                  >
                    <span className={`theme-icon theme-${option.id}`} aria-hidden="true">
                      {option.icon}
                    </span>
                    <span className="theme-tile-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-field">
              <strong>强调色</strong>
              <div className="accent-picker">
                {(
                  [
                    { id: "blue", label: "蓝" },
                    { id: "violet", label: "紫" },
                    { id: "green", label: "绿" },
                    { id: "orange", label: "橙" },
                    { id: "rose", label: "玫红" },
                    { id: "cyan", label: "青" },
                    { id: "amber", label: "琥珀" },
                    { id: "lime", label: "青柠" },
                  ] as { id: AccentPref; label: string }[]
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`accent-dot accent-${option.id}${prefs.accent === option.id ? " active" : ""}`}
                    onClick={() => setPref("accent", option.id)}
                    data-tip={option.label}
                    aria-label={option.label}
                  />
                ))}
              </div>
            </div>

            <div className="setting-field">
              <strong>字号</strong>
              <div className="font-slider">
                <input
                  type="range"
                  min={0}
                  max={FONT_OPTIONS.length - 1}
                  step={1}
                  value={Math.max(0, FONT_OPTIONS.findIndex((option) => option.id === prefs.font))}
                  aria-label="字号"
                  onChange={(event) => {
                    const option = FONT_OPTIONS[Number(event.target.value)];
                    if (option) setPref("font", option.id);
                  }}
                />
                <div className="font-ticks">
                  {FONT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={prefs.font === option.id ? "active" : ""}
                      onClick={() => setPref("font", option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="setting-field">
              <strong>界面风格</strong>
              <div className="theme-picker">
                {(
                  [
                    { id: "product", label: "产品" },
                    { id: "native", label: "原生" },
                  ] as { id: StylePref; label: string }[]
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`theme-tile${prefs.style === option.id ? " active" : ""}`}
                    onClick={() => setPref("style", option.id)}
                  >
                    <span className={`thumb style-${option.id}`} aria-hidden="true">
                      <span className="thumb-top">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="thumb-body">
                        <span className="thumb-side" />
                        <span className="thumb-content">
                          <span className="thumb-line w70" />
                          <span className="thumb-line w95" />
                          <span className="thumb-line w50" />
                          <span className="thumb-btn" />
                        </span>
                      </span>
                    </span>
                    <span className="theme-tile-label">{option.label}</span>
                  </button>
                ))}
              </div>
              <p className="muted">产品风：渐变光晕、玻璃卡片、大标题、留白更松；原生风：紧凑的工具型外观。</p>
            </div>
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
            <Toggle prefKey="chatEnabled" label="内置对话" hint="在应用内用自己的模型对话与规划" />
            <Toggle prefKey="terminalEnabled" label="终端入口" hint="显示内嵌终端页面，原生调用" />
            <Toggle prefKey="liveRefresh" label="实时同步" hint="监听工作区文件变化并自动刷新" />
            <div className="setting-field">
              <strong>上下文窗口大小</strong>
              <p className="muted">对话里「上下文用量」估算的分母，按你所用模型的上下文长度填（tokens），默认 128000。</p>
              <input
                type="number"
                min={1000}
                step={1000}
                value={prefs.contextLimit}
                onChange={(event) => setPref("contextLimit", Math.max(1000, Number(event.target.value) || 0))}
              />
            </div>
          </>
        )}

        {category === "plugins" && (
          <>
            <div className="card-head">
              <h2>插件</h2>
            </div>
            <Toggle prefKey="signatureEnabled" label="个性签名" hint="在顶栏标题旁显示一句你自己的话。" />
            {prefs.signatureEnabled && (
              <div className="setting-field">
                <strong>签名内容</strong>
                <input
                  value={prefs.signature}
                  maxLength={60}
                  placeholder="例如：病树前头万木春"
                  onChange={(event) => setPref("signature", event.target.value)}
                />
              </div>
            )}
            <div className="setting-field">
              <strong>已安装插件</strong>
              <p className="muted">
                插件放在应用数据目录的 <code className="code">plugins/</code> 下，每个子目录含{" "}
                <code className="code">plugin.json</code>。支持：命令面板命令、agent 工具、API handler。
              </p>
              {plugins.length === 0 ? (
                <p className="muted">还没有安装插件。</p>
              ) : (
                <ul className="plugin-list">
                  {plugins.map((plugin) => (
                    <li key={plugin.id} className="plugin-item">
                      <div className="plugin-head">
                        <strong>{plugin.name}</strong>
                        {plugin.version && <span className="muted">{plugin.version}</span>}
                      </div>
                      {plugin.description && <p className="muted">{plugin.description}</p>}
                      <p className="muted">
                        命令 {plugin.commands.length} · 工具 {plugin.tools.length} · handler {plugin.handlers.length}
                      </p>
                      {plugin.error && <p className="warn-text">加载失败：{plugin.error}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {category === "storage" && (
          <>
            <div className="card-head">
              <h2>存储</h2>
            </div>
            <div className="setting-field">
              <strong>模型配置文件</strong>
              <p className="muted">
                要填一个<b>文件</b>路径，例如 <code className="code">D:\Work\myblog-agent.json</code>；不能填目录，也不能填盘符根目录（例如
                <code className="code">D:\</code>）。单个工作区想用不同模型，见「对话 → 设置」里的配置档 / 工作区文件。
              </p>
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
              <p className="muted">
                要填一个<b>目录</b>路径（每个工作区在这里各存一份历史），不能填文件或盘符根目录。改到别处后，旧目录不会被自动搬移。
              </p>
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
