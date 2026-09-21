# MyBlog

[![CI](https://github.com/Sayb1e/myblog/actions/workflows/ci.yml/badge.svg)](https://github.com/Sayb1e/myblog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-brightgreen.svg)](https://nodejs.org/)
[![version](https://img.shields.io/badge/version-1.1.3-informational.svg)](./CHANGELOG.md)

管理「基于 markdown 的本地学习工作区」的**桌面应用（Electron）+ CLI**：解析与写回**进度总览 / 岗位能力地图 / 每日总结**，把「今天学什么、上次停在哪」变得可见、可 diff、可回滚。

> 本地单用户工具，不引入数据库。**markdown 是唯一数据源**，人能改、能 git。核心不调用任何 LLM：它只负责解析、生成、校验、组装上下文；「今天干什么」由你或你用的 AI agent 判断。

## 它解决什么

- **今天学什么**：把总览里的「下次从哪继续」和岗位目标里的当前阶段 G 能力取交集。
- **上次停在哪**：聚合当前阶段、能力状态、最近一次总结与学习记录。
- **写回不炸 diff**：只替换目标段落 / 插入表格行，绝不整篇重新序列化；幂等、可 diff、保持原行尾。
- **一致的校验**：G 编号是否有定义、`最近一次` 目录是否存在、每个日期目录是否有总结、学习记录链接是否可达、根目录是否有疑似附件。

## 快速开始

> 不想装 Node？直接在 [Releases](https://github.com/Sayb1e/myblog/releases) 下载免安装的 Windows 版 `MyBlog x.y.z.exe`，双击即用。

要求 Node.js **22+**（`>=20.19` 也可）与 npm。

```bash
git clone <repo-url> MyBlog
cd MyBlog
npm install
npm run build
```

起桌面应用（`npm run app` = 构建全部 + 启动 Electron；首次启动会让你选学习仓）：

```bash
npm run app
```

只想要 CLI，也可以直接用：

```bash
node packages/cli/dist/index.js -C "D:/path/to/learning-workspace" context --json
```

> 发布到 npm 后，上面的 `node packages/cli/dist/index.js` 可替换为 `myblog`（bin 名称已就绪）。

## 工作区约定

```
learning-workspace/
├── 学习进度总览.md        # 背景与目标 / 现在学到哪了 / 学习方向 / 学习记录 / 工具与环境备忘
├── 岗位目标.md            # 当前阶段 / 能力编号 / 阶段顺序
├── AGENTS.md              # 可选：给 AI agent 的说明（myblog init 会托管一段）
├── 2026-09-17/
│   └── 总结.md            # # YYYY-MM-DD + 前情提要 / 这次（含「能力：G?」）/ 下次从哪继续
└── 2026-09-18/            # 当天产生的工程 / 脚本 / APK 一律进日期子目录
```

- 「现在学到哪了」是标签段落：`学到哪了：…`、`下次从哪继续：…`、`最近一次：[日期](路径)`。
- 「学习记录」是 GFM 表格：`| 日期 | 这次做了什么 | 链接 |`，新记录插在表头下方第一行。
- 「能力编号」表格：`| 编号 | 能力 | 岗位侧在问什么 | 当前状态 |`。

文件名可用工作区根目录的 `myblog.config.json` 覆盖：

```json
{
  "overview": "学习进度总览.md",
  "goals": "岗位目标.md",
  "summaryFile": "总结.md"
}
```

## CLI

CLI 只保留桌面端替代不了的部分：**MCP 服务**、工作区初始化、状态输出。

全局选项：`-C, --root <dir>`（默认 `MYBLOG_ROOT`，再默认当前目录）。

| 命令 | 说明 |
| --- | --- |
| `myblog status [--json]` | 当前阶段、活跃能力、进度与最近记录 |
| `myblog mcp` | 以 stdio 启动 MCP server，供 AI 客户端调用 |
| `myblog init [-a, --agent <list>] [--force] [--workspace]` | 写入 AI 接入模板；`--workspace` 同时初始化学习仓结构 |

> 每日规划、收工写回、校验这些都在**桌面端应用**里做（阶段 / 能力地图 / 时间线 / 对话 / 终端）。

## 接入 AI agent

MyBlog 与 agent 无关：**契约是 MCP 工具**（`myblog_context`、`myblog_check`、`myblog_read_summary`、`myblog_scaffold`、`myblog_close`）与 `myblog status --json`。各家的命令 / skill 只是薄壳，由 `init` 生成：

```bash
myblog init --agent all          # opencode + claude + cursor + AGENTS.md
myblog init --agent opencode     # 只装 opencode
```

| agent | 生成位置 |
| --- | --- |
| opencode | `.opencode/command/{today,close}.md`、`.opencode/skills/learning-loop/SKILL.md`、`.opencode/opencode.json`（注册 MyBlog MCP server） |
| Claude Code | `.claude/commands/{today,close}.md`、`.claude/skills/learning-loop/SKILL.md` |
| Cursor | `.cursor/commands/{today,close}.md` |
| 通用 | `AGENTS.md` 里的托管块（`<!-- myblog:start --> … <!-- myblog:end -->`，不改动你已有内容） |

- 重复执行幂等；已有文件默认跳过，`--force` 覆盖；`.opencode/opencode.json` 与 `AGENTS.md` 只做合并/原地更新，不动你已有配置。
- MCP 工具：`myblog_context`、`myblog_check`、`myblog_read_summary`、`myblog_scaffold`、`myblog_close`；桌面端的对话窗口另有 `fs_list` / `fs_read` / `fs_write` 用于读写工作区普通文件。
- `myblog_close` **默认 `dryRun=true`**：先返回 diff 预览，用户确认后再以 `dryRun=false` 调用才落盘。

## 桌面应用

桌面版（Electron）内置服务与界面，双击即用：

- **今日该干什么**：下次继续 + 当前活跃 G 能力。
- **进度 / 能力地图 / 时间线**：总览与岗位目标的可视化。
- **每日总结**：读取、编辑、分栏、预览；`新建当日总结`；`收工写回总览`（可勾选只预览）。
- **校验**：断链、未定义 G、缺总结、根目录附件。
- **多工作区**：顶栏切换；`添加工作区` 选目录（切换仅限白名单）。
- **命令面板** `Ctrl/Cmd+K`、快捷键帮助 `?`。

空文件夹也能用：缺少 `学习进度总览.md` 时显示引导卡，可**一键初始化**生成最小结构。

### 内置对话（用自己的模型）

填入自己的模型即可像聊天一样规划学习（OpenAI 兼容：OpenAI、DeepSeek、通义、Kimi、OpenRouter、Ollama 等）；也可在「设置 → 存储」自定义模型配置文件与对话历史的存放位置。

- Key 只存本地（应用数据目录），**不会下发到界面**；也可用 `MYBLOG_AGENT_BASE_URL` / `MYBLOG_AGENT_API_KEY` / `MYBLOG_AGENT_MODEL` 覆盖。
- 内置工具：`myblog_context`、`myblog_check`、`myblog_read_summary`、`myblog_scaffold`、`myblog_close`。
- **写回安全**：`myblog_close` 默认 `dryRun=true`，先在对话里出 diff 卡片，你同意后模型才会以 `dryRun=false` 落盘。

### 终端

内置一个**真终端**（xterm.js + node-pty，winpty 后端），工作目录就是当前学习库：

- 可直接运行 `opencode`、`claude`、`codex`、`myblog`、git 或任意命令。
- 切换页面不会中断会话。

## 架构

```
@myblog/core     解析 / 生成 / 校验 / 组装（唯一引擎，无 LLM、无 DB）
@myblog/agent    OpenAI 兼容模型客户端 + 工具调用循环（唯一持 key 的地方）
   ├── @myblog/cli      status / today / context / scaffold / close / check / init / mcp
   ├── @myblog/server   Hono：/api/*（含 /api/chat SSE），桌面端内置使用
   ├── @myblog/web      Vite + React 界面（由桌面端加载）
   └── @myblog/desktop  Electron：内置 server + 真终端
```

设计原则：

- **外科手术式写回**：只替换目标段落 / 表格行。
- **幂等**：重复执行不产生重复记录；`closeDay` 不会把「最近一次」回退到旧日期。
- **保持行尾**：按原文件主导行尾（LF / CRLF）写回。
- **单一数据源**：所有状态来自 markdown，可随时人工编辑或 git。

## 开发

```bash
npm install
npm run build            # core → server → cli → web
npm run typecheck        # 四包类型检查
npm run typecheck:test   # 测试代码类型检查
npm test                 # vitest 单测
```

- core 的 fixture 在 `packages/core/test/fixtures/`（结构复刻真实工作区，内容脱敏）。
- 用真实工作区跑只读字节级测试：`MYBLOG_REAL_ROOT=/path/to/workspace npm test`。
- 桌面开发：`npm run app`（构建全部并启动 Electron）；只改界面时 `npm run desktop`（需先 build 过 web）。

## 截图

> 待补：仪表盘总览、能力地图、每日总结编辑器。放到 `docs/` 并在本段引用。

## License

MIT
