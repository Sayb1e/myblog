# MyBlog

[![CI](https://github.com/Sayb1e/myblog/actions/workflows/ci.yml/badge.svg)](https://github.com/Sayb1e/myblog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-brightgreen.svg)](https://nodejs.org/)
[![version](https://img.shields.io/badge/version-1.2.1-informational.svg)](./CHANGELOG.md)

管理「基于 markdown 的本地学习仓」的**桌面应用**：进度总览 / 能力地图 / 每日总结，写回可 diff、可回滚、可 git。
markdown 是唯一数据源，核心不调用任何 LLM——「今天干什么」由你或你用的 AI 判断。

## 下载即用（Windows）

到 [Releases](https://github.com/Sayb1e/myblog/releases) 下载，**不需要装 Node、不需要配置，开箱即用**：

| 文件 | 说明 |
| --- | --- |
| `MyBlog_v1.2.1_setup.exe` | **安装版（推荐）**：中文向导 + 许可页；可选安装目录，建桌面/开始菜单快捷方式，带卸载项；装到用户目录，不需要管理员 |
| `MyBlog_v1.2.1_portable.exe` | **免安装单文件**：双击即用，卸载 = 删掉这个文件 |
| `SHA256SUMS.txt` | 校验和（`certutil -hashfile <文件> SHA256` 对一下） |

- **首次运行**：SmartScreen 会拦一次（exe 未做代码签名）→「更多信息」→「仍要运行」。
- **首次启动让你选“学习库”目录**：随便建个文件夹即可，**空目录也能用**——概览页点「一键初始化」会生成最简结构。
- **数据在哪**：学习数据就是你那个文件夹里的 markdown；模型配置 / 对话历史 / 工作区白名单在 `%APPDATA%\@myblog\desktop`（设置里可改）。
- **卸载**：删掉安装的程序（或 portable 文件）；想连配置一起清就再删上面的目录。

## 截图

| 概览：今日学习 · 进度 · 能力地图 · 时间线 · 版本 | 每日总结：编辑 / 分栏 / 预览（左右联动滚动） |
| --- | --- |
| <img src="docs/overview.png" width="470" alt="概览：今日学习、进度、能力地图、时间线、版本卡片"> | <img src="docs/daily-split.png" width="470" alt="每日总结：编辑、分栏、预览三模式"> |

## 特色

- **今天学什么**：把总览的「下次从哪继续」和当前阶段 G 能力取交集，直接给结论；「上次停在哪」一眼可见。
- **能力地图**：点某个 G **就地展开**（验证问题 / 相关总结），可直接**改状态并写回 `GOALS.md`**；选中时时间线自动按该 G 筛选。
- **写回不炸 diff**：只替换目标段落 / 插入表格行，绝不整篇重写；幂等、保持原行尾、可 git 回滚。
- **内置对话**：填自己的模型（OpenAI 兼容；本机 opencode 已登录可**一键导入** OpenCode Go / Zen）。工具调用（读工作区 / 写文件 / 写回总览）**默认先出 diff，你确认后才落盘**。
- **文件 · 终端 · 搜索**：目录树 + markdown / 代码高亮 / 图片预览、右键复制路径；内置真终端（xterm.js + node-pty，切页面不中断）；`Ctrl+K` 全局搜索（命令 + 搜索总览/目标/各天总结内容）；校验页检查断链、未定义 G、缺总结、根目录附件。
- **多工作区 · 一键提交**：侧栏切换工作区；概览「版本」卡片显示分支与未提交改动，可 `git add -A` 一键提交。
- **本地优先**：不开任何 TCP 端口、无数据库、无中转服务；主题（深/浅/跟随系统）、8 种强调色、字号可调。

## 从源码跑（可选）

要求 Node.js **22+**（`>=20.19` 也可）与 npm。

```bash
git clone https://github.com/Sayb1e/myblog.git MyBlog
cd MyBlog
npm install
npm run app              # 构建全部 + 启动 Electron
```

只想用命令行（`status` 看进度 / `init` 写 AI 接入模板 / `mcp` 起 MCP server）：

```bash
node packages/cli/dist/index.js -C "D:/path/to/learning-workspace" status --json
```

## 工作区约定

```
learning-workspace/
├── PROGRESS.md        # 背景与目标 / 现在学到哪了 / 学习方向 / 学习记录 / 工具与环境备忘
├── GOALS.md           # 可选：当前阶段 / 能力编号（能力地图来源）/ 阶段顺序
├── AGENTS.md          # 可选：给 AI agent 的说明（myblog init 会托管一段）
├── 2026-09-17/
│   └── 总结.md         # # YYYY-MM-DD + 前情提要 / 这次（含「能力：G?」）/ 下次从哪继续
└── 2026-09-18/        # 当天产生的工程 / 脚本 / APK 一律进日期子目录
```

- 「现在学到哪了」是标签段落：`学到哪了：…`、`下次从哪继续：…`、`最近一次：[日期](路径)`。
- 「学习记录」是 GFM 表格：`| 日期 | 这次做了什么 | 链接 |`，新记录插在表头下方第一行。
- 「能力编号」表格：`| 编号 | 能力 | 岗位侧在问什么 | 当前状态 |`（写在 `GOALS.md`）。
- `GOALS.md` **可选**：没有它也能用（阶段与能力地图为空，校验只给一条警告）。
- 文件名可用根目录 `myblog.config.json` 覆盖：`{ "overview": "PROGRESS.md", "goals": "GOALS.md", "summaryFile": "总结.md" }`。

## 接入 AI agent

MyBlog 与 agent 无关：**契约是 MCP 工具**，各家的命令 / skill 只是薄壳，由 `init` 生成：

```bash
myblog init --agent all          # opencode + claude + cursor + AGENTS.md
myblog init --agent opencode     # 只装 opencode
```

| agent | 生成位置 |
| --- | --- |
| opencode | `.opencode/command/{today,close}.md`、`.opencode/skills/learning-loop/SKILL.md`、`.opencode/opencode.json`（注册 MCP server） |
| Claude Code | `.claude/commands/{today,close}.md`、`.claude/skills/learning-loop/SKILL.md` |
| Cursor | `.cursor/commands/{today,close}.md` |
| 通用 | `AGENTS.md` 里的托管块（`<!-- myblog:start --> … <!-- myblog:end -->`，不动你已有内容） |

- MCP 工具：`myblog_context`、`myblog_check`、`myblog_read_summary`、`myblog_scaffold`、`myblog_close`，以及读写普通文件的 `fs_list` / `fs_read` / `fs_write`（路径限制在工作区内）。
- 重复执行幂等；已有文件默认跳过，`--force` 覆盖；`opencode.json` 与 `AGENTS.md` 只做合并/原地更新。

## 架构

```
@myblog/core     解析 / 生成 / 校验 / 组装（唯一引擎，无 LLM、无 DB）
@myblog/agent    OpenAI 兼容模型客户端 + 工具调用循环（唯一持 key 的地方）
   ├── @myblog/cli      只读状态 / 初始化模板 / MCP server
   ├── @myblog/server   与传输无关的工作区 API handler（不开端口）
   ├── @myblog/web      Vite + React 界面（由桌面端加载）
   └── @myblog/desktop  Electron：经 IPC 调用 @myblog/server + 真终端
```

设计原则：**外科手术式写回**（只动目标段落/表格行）、**幂等**、**保持行尾**、**单一数据源**（全部来自 markdown）、**无本地服务**（桌面端不监听任何端口，渲染进程走 preload 的 IPC 桥）。

## 开发

```bash
npm run build            # core → agent → server → cli → web
npm run typecheck        # 五个包类型检查
npm run typecheck:test   # 测试代码类型检查
npm test                 # vitest 单测
npm run desktop          # 只构建并启动 Electron main（需先 build 过 web）
```

- core 的 fixture 在 `packages/core/test/fixtures/`（结构复刻真实工作区，内容脱敏）；用真实工作区跑只读字节级测试：`MYBLOG_REAL_ROOT=/path/to/workspace npm test`。
- 打包：`npm run build` → `npm run build --workspace @myblog/desktop` → `npx electron-builder --win portable nsis`（在 `packages/desktop` 下）。
- 冒烟（无需人工点）：`$env:MYBLOG_DESKTOP_SMOKE="1"; $env:MYBLOG_DESKTOP_ROOT="<学习库>"` 启动 exe，会打印 `SMOKE_OK` 与页面文本；加 `"pty"` 再验终端。
- 图标：`node packages/desktop/scripts/make-icons.mjs` 生成 `packages/desktop/build/`（改品牌色后重跑）。

## 常见问题

**终端里跑不了 `opencode` / `claude`？**
终端是真实 PTY，工作目录是你的学习库；命令需要在系统 PATH 里（和普通 PowerShell 一样）。

**杀软 / SmartScreen 报警？**
exe 未做代码签名。用 Release 里的 `SHA256SUMS.txt` 校验来源，或从源码自行构建。

**模型 key 会传到哪？**
只写在本机 `agent.json`（默认 `%APPDATA%\@myblog\desktop`，设置里可改路径），请求时直接发给**你自己填的 baseURL**；也可以用 `MYBLOG_AGENT_BASE_URL` / `MYBLOG_AGENT_API_KEY` / `MYBLOG_AGENT_MODEL` 覆盖。MyBlog 没有任何中转服务。

**能多人协作 / 同步吗？**
学习库就是普通 git 仓库（`PROGRESS.md` + 日期目录），用 git 同步即可；应用不依赖网络。

## License

MIT
