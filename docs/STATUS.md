# 项目状态与交接（给 AI / 协作者）

**新会话请按这个顺序读**：`AGENTS.md`（约定与命令）→ 本文件（当前进度 / 待办 / 已知坑）→ `CHANGELOG.md`（已发布内容）→ `README.md`（产品说明）。

## 当前版本

| 项 | 状态 |
| --- | --- |
| package 版本 | **1.2.3**（改动已完成并打包，**尚未 commit / 尚未发 Release**） |
| 最近已发布 | **v1.2.1**（GitHub Release：`MyBlog_v1.2.1_setup.exe` + `_portable.exe` + `SHA256SUMS.txt`） |
| 待发布 | **1.2.2 + 1.2.3**（草稿尚未创建；推 `v*` tag 会由 CI 自动构建并建草稿 Release） |
| 本地产物 | `packages/desktop/release/win-unpacked/MyBlog.exe`（最新）；`release/*.exe` 为上次打包的安装包 |

## 1.2.3 里已经做完（未发布）

- **每工作区单独指定模型**：对话 → 设置里「保存到」（默认 / 配置档 / 工作区文件 `myblog.agent.json` / 新建配置档）与「此工作区使用」（继承 / 绑定配置档）；生效优先级 `环境变量 → 工作区文件 → 配置档 → 默认`。
- **修 `EPERM: mkdir 'D:\'`**：存储路径校验（模型配置必须是文件、历史必须是目录、拒绝盘符根）+ 写配置/初始化前判断目录存在并容忍 `EPERM`。
- **历史目录可读化 + 可迁移**：`<别名或文件夹名>-<短哈希>` + 目录内 `workspace.json`；旧哈希目录、最早的单文件历史自动迁移；改别名会改名目录并保住会话。
- **Anthropic 格式支持**：`packages/agent` 新增 `/messages` provider（`x-api-key` + `anthropic-version`、SSE `text_delta` / `tool_use`、`tool_result` 合并），设置里有「API 格式：自动 / OpenAI 兼容 / Anthropic」。
- **opencode 网关**：请求自动补 `x-opencode-session`；「导入 opencode」会读 `~/.cache/opencode/models.json` 列出模型并标注格式；`grok-4.6` 在该网关不可用（503），默认改用 `deepseek-v4-flash` / `glm-4.7`。

## 待办（候选，均未开始）

1. **发 Release**：`git push` main 后打 `v1.2.3` tag（CI 会自动 build + 开草稿 Release，再补说明并发布）。
2. **winget / Scoop 收录**（有签名后体验更好）。
3. **代码签名**（消除 SmartScreen「未知发布者」）。
4. README 里补 1–2 个 **GIF**（8–12 秒、fps 10、宽 900、≤5MB；规范见 `docs/README.md`）。
5. （可选）one-click 安装器 / 向导里加「选择学习库目录」页。
6. （可选）历史存放位置可选「应用数据目录 / 工作区内 `.myblog/`」。
7. 清理 `D:\Work\Test_1` 的历史残留（`3c7afcafa7673ad1`、`48f34fbcf3ec....json` —— 该工作区已不在白名单，不会被认领）。

## 已知坑（务必知道）

- **打包顺序**：`npm run build` → `npm run build --workspace @myblog/desktop` → 在 `packages/desktop` 下 `npx electron-builder --win --dir|portable|nsis`。根 `build` **不含** Electron main，漏掉会把旧 main.js 打进包。
- 打包前**先关掉正在运行的 MyBlog**（文件占用会导致失败）。
- **不要**把「模型配置」设成目录或盘符根（会 `EPERM`）；「历史目录」必须是目录。
- opencode `go` 网关必须带 `x-opencode-session` 头（代码里已自动加）；`grok-4.6` 在该网关不可用，选 `deepseek-v4-flash` 这类。
- 工作区文件名：`PROGRESS.md` / `GOALS.md`（**旧中文名不再兼容**）；`GOALS.md` 可选。
- 冒烟：`MYBLOG_DESKTOP_SMOKE="1"` + `MYBLOG_DESKTOP_ROOT="<学习库>"` 启动 exe 打印 `SMOKE_OK` 与页面文本；`MYBLOG_DESKTOP_SMOKE="pty"` 验终端；`MYBLOG_DESKTOP_EVAL="<js>"` 可在渲染进程里执行表达式（量坐标用）。
- 本机关键路径：学习库 `D:\Mobile`；应用数据 `%APPDATA%\@myblog\desktop`（`agent.json` / `history` / `settings.json`）；GitHub 推送常被重置，需要一次性代理 `git -c http.proxy=http://127.0.0.1:7897 push`。

## 验证命令

```bash
npm run build && npm run typecheck && npm run typecheck:test && npm test
```

## 新会话怎么开口（示例）

> 读 `AGENTS.md` 和 `docs/STATUS.md`，然后帮我把 1.2.3 发 Release（先 commit + push，再打 tag）。

或者：

> 读 `AGENTS.md` 和 `docs/STATUS.md` 的「待办」，我们来挑第 N 条一起做。
