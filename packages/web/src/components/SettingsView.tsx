import { useState } from "react";
import { usePrefs, type Prefs, type StylePref, type ThemePref } from "../prefs.js";

interface Props {
  root: string;
  version: string;
}

type CategoryId = "ui" | "features" | "about";

const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: "ui", label: "界面", icon: "◨" },
  { id: "features", label: "功能", icon: "⚙" },
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
