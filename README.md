# MyBlog

[![CI](https://github.com/Sayb1e/myblog/actions/workflows/ci.yml/badge.svg)](https://github.com/Sayb1e/myblog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-brightgreen.svg)](https://nodejs.org/)
[![version](https://img.shields.io/badge/version-1.1.2-informational.svg)](./CHANGELOG.md)

管理「基于 markdown 的本地学习工作区」的本地 Web 应用 + CLI：解析与写回**进度总览 / 岗位能力地图 / 每日总结**，把「今天学什么、上次停在哪」变得可见、可 diff、可回滚。

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

起本地仪表盘（把下面路径换成你的学习仓）：

```bash
node packages/cli/dist/index.js -C "D:/path/to/learning-workspace" serve
# 浏览器打开 http://127.0.0.1:5174
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

全局选项：`-C, --root <dir>`（默认 `MYBLOG_ROOT`，再默认当前目录）。

| 命令 | 说明 |
| --- | --- |
| `myblog status [--json]` | 当前阶段、活跃能力、进度与最近记录 |
| `myblog today [--json]` | 今日上下文：阶段、活跃能力、下次继续、最近总结 |
| `myblog context [--json]` | **给 AI agent 的完整上下文**（状态 + 今日 + 校验 + 最近总结） |
| `myblog scaffold [date] [--preview] [--next] [--skills]` | 生成当日 `总结.md` 骨架（不覆盖已有） |
| `myblog close [--date] [--learned] [--next] [--did] [--dry-run]` | 把当天结论写回总览（进度 + 学习记录） |
| `myblog check [--json] [--strict]` | 校验工作区一致性 |
| `myblog mcp` | 以 stdio 启动 MCP server，供 AI 客户端调用 |
| `myblog serve [-p] [--host] [--web] [--api-only]` | 起本地仪表盘 |
| `myblog init [-a, --agent <list>] [--force]` | 写入 AI 接入模板 |

写回前建议先 `--dry-run` 看改动：

```bash
myblog close --date 2026-09-18 \
  --learned "G2 闭环" --next "写 Frida Hook" --did "装包跑通，读到 DENIED" \
  --dry-run
```

## 接入 AI agent

MyBlog 与 agent 无关：**契约是 `myblog context --json`**。各家的命令 / skill 只是薄壳，由 `init` 生成：

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
- MCP 工具：`myblog_context`、`myblog_check`、`myblog_read_summary`、`myblog_scaffold`、`myblog_close`。
- `myblog_close` **默认 `dryRun=true`**：先返回 diff 预览，用户确认后再以 `dryRun=false` 调用才落盘。

## Web 仪表盘

`myblog serve` 后打开 `http://127.0.0.1:5174`：

- **今日该干什么**：下次继续 + 当前活跃 G 能力。
- **进度 / 能力地图 / 时间线**：总览与岗位目标的可视化。
- **每日总结**：读取、编辑、保存；`新建当日总结`；`收工写回总览`（可勾选只预览）。
- **校验**：断链、未定义 G、缺总结、根目录附件。

### 内置对话（用自己的模型）

Web 与桌面端都有「对话」页：填入自己的模型即可像聊天一样规划学习。

- 支持 **OpenAI 兼容**接口（OpenAI、DeepSeek、通义、Kimi、OpenRouter、Ollama 等）：填 `baseURL` + `model` + `apiKey`。
- Key 存在本地（服务端为 `~/.myblog/agent.json`，桌面端为应用数据目录），**不会下发到页面**；也可用 `MYBLOG_AGENT_BASE_URL` / `MYBLOG_AGENT_API_KEY` / `MYBLOG_AGENT_MODEL` 覆盖。
- 每次对话自动注入当前工作区上下文，并提供工具：`myblog_context`、`myblog_check`、`myblog_read_summary`、`myblog_scaffold`、`myblog_close`。
- **写回安全**：`myblog_close` 默认 `dryRun=true`，先在对话里出 diff 卡片，你同意后模型才会以 `dryRun=false` 落盘。

### 终端（桌面端）

桌面版内置一个**真终端**（xterm.js + node-pty / ConPTY，winpty 后端），工作目录就是当前学习库：

- 可直接运行 `opencode`、`claude`、`codex`、`myblog`、git 或任意命令——**任何 CLI 都能在这里用**。
- 终端只在桌面端出现；浏览器模式不显示该入口。

### 远程访问（默认关闭）

本地写 API 默认无鉴权，因此 `serve` **默认只绑 `127.0.0.1`**。确需局域网访问时：

```bash
myblog serve --host 0.0.0.0 --allow-remote --token <your-token>
```

启用后所有写接口都要求 `x-myblog-token`（或 `Authorization: Bearer`）。Web UI 会在需要时提示输入并记住。

## 架构

```
@myblog/core     解析 / 生成 / 校验 / 组装（唯一引擎，无 LLM、无 DB）
@myblog/agent    OpenAI 兼容模型客户端 + 工具调用循环（唯一持 key 的地方）
   ├── @myblog/cli      status / today / context / scaffold / close / check / serve / init / mcp
   ├── @myblog/server   Hono：/api/*（含 /api/chat SSE）+ 伺服 Web 静态资源
   ├── @myblog/web      Vite + React 仪表盘（含对话页）
   └── @myblog/desktop  Electron 薄壳（内置 server，无终端）
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
- 前端开发：终端 A `node packages/cli/dist/index.js serve --api-only`，终端 B `npm run dev --workspace @myblog/web`（Vite 代理 `/api`）。

## 截图

> 待补：仪表盘总览、能力地图、每日总结编辑器。放到 `docs/` 并在本段引用。

## License

MIT
