# 项目状态与交接（给 AI / 协作者）

**新会话请按这个顺序读**：`AGENTS.md`（约定与命令）→ 本文件（当前进度 / 待办 / 已知坑）→ `CHANGELOG.md`（已发布内容）→ `README.md`（产品说明）。

## 当前版本

| 项 | 状态 |
| --- | --- |
| package 版本 | **1.4.0**（周复盘 / 全局快记收件箱 / AI 跨库只读检索；未打 tag） |
| 最近已发布 | **v1.3.2**（GitHub Release Latest：`MyBlog_v1.3.2_setup.exe` + `_portable.exe` + `SHA256SUMS.txt`；主分支与 tag 均已推送） |
| 待发布 | **v1.4.0**（周复盘 + 收件箱 + 跨库读；发布流程：commit/push → 打 `v1.4.0` tag → CI 建 Release） |
| 本地产物 | `packages/desktop/release/win-unpacked/MyBlog.exe`（1.4.0，已随最近改动重打包） |

## 1.4.0 已完成（待发布）

- **动态规划（对话内）**：`chat.ts` 系统提示规定——问「今天 / 接下来学什么、准备学什么、帮我安排一下」这类规划问题时，先自动回顾**计划内**（注入的能力/记录）+ **计划外**（收件箱），必要时用只读工具补齐，**回顾之后再给动态规划**并附依据。周复盘功能已按用户要求彻底移除（无 `review.ts` / `REVIEW-*.md` / 复盘日志）。
- **收获收件箱（独立页面 · 目录 · 双模式）**：侧栏「收件箱」→ `InboxView`（左列表 + 右编辑，默认一天一个文件、可新建/切换、约 1.2s 自动保存 / `Ctrl+S`）；编辑分**源码模式**与**编辑模式**——编辑模式是 **Obsidian 式 live preview**（`MarkdownLiveEditor`：CodeMirror 6 + `@codemirror/lang-markdown`，自写 ViewPlugin 装饰：非当前行隐藏标记、当前行显示源码；文档保持原始 Markdown 不改写）。结构化文档仍源码 + 实时预览。server：`inboxList` / `inboxRead` / `inboxWrite`。路径 `StorageSettings.inboxDir`（默认 `~/.myblog/inbox`）。`InboxView` 懒加载。
- **AI 跨库只读检索**：对话给 agent 追加只读工具 `myblog_search_all`（在 `streamChat` 里作为 `extraTools` 注入），跨所有注册学习库 + 收件箱搜关键词（`crossLibSearch` 复用各库 `PROGRESS/GOALS/SUMMARY`）。只读，不写任何库。
- **收件箱计入里程碑**：`milestones` handler 额外读 `inboxDir` 里文件名带日期的笔记（`YYYY-MM-DD*.md`），按文件名日期计入「当天活动」（热力图/曲线/成就活动天数），**不计入每日总结数**。
- **备份与恢复 / 对话健壮性 / 收件箱文件管理 / GFM**：设置→存储 或命令面板打开 `BackupsPanel`（列 `.myblog/backups/`、看内容、一键恢复，`backups`/`readBackup`/`restoreBackup` handler）；对话加「重试」+ 上下文自动裁剪 + 长会话分页渲染；收件箱 `inboxRename`/`inboxDelete` + 文件名过滤；live preview 补齐 GFM（任务/表格/图片/分隔线）。里程碑聚合加 10s 缓存（`milestonesCache`，切库/文件变化失效）。
- **热力图点击明细**：`dayProgress` handler 返回某天跨库的 `records`/`summaries`/`inbox`；`ActivityHeatmap` 格子改为可点，App 弹 `DayProgress` 列出（悬停提示保留）。

## 1.3.2 已完成（已发布）

- **成就系统视觉重做**：23 个独立徽章 SVG、勋章墙网格、青铜/白银/黄金稀有度、未解锁环形进度、状态+分类筛选、点击详情弹窗。逻辑在 `packages/web/src/achievements.ts`，徽章在 `packages/web/src/components/AchievementBadge.tsx`，视图在 `components/Milestones.tsx`。概览页已移除成就卡；里程碑页三列并排——成就（三行、列内上下滚动、右下角「全部成就」弹窗看完整成就墙）、热力图、曲线；详情弹窗居中。
- **对话增强**：代码块带行号（左侧序号栏，横滚时固定）；输入框随内容自动加高（≤160px）；助手回复气泡加宽（`max-width: min(1100px, 92%)`，窄窗口 ≤900px 时铺满）；系统提示注入**当前系统时间**（`packages/agent/src/time.ts`，chat 与 goals 都用），模型不再猜日期。修 toast 层级低于弹窗（「测试连接」结果被设置框盖住）——toast `z-index` 50→200。
- **新增 `fs_move` 工具**（`packages/agent/src/tools.ts` + `packages/cli/src/mcp.ts`）：工作区内移动/重命名/归档文件与目录，默认 dry-run 预览、目标已存在不覆盖。
- **里程碑跨库聚合**：新增 server `milestones` handler（`handlers.ts`）汇总所有注册学习库的记录/总结/能力；`useWorkspace` 拉取，App 的 `activity` 与成就输入（`closedCapabilities`/`goalCount`）改用它，热力图/曲线/成就跨库。`MilestonesView` 在 >1 库时提示。
- **修整体界面横向平移**：超长不可断文本自动换行（`.md`/`.bubble`/`.user-text` `overflow-wrap:anywhere`），宽表格用 `Markdown.tsx` 的 `table` 包一层 `.md-table-wrap`（内部横滚），`.content` 与 `body` 设 `overflow-x:hidden`。

## 1.3.1（已发布）

- **终端 = 底部 dock**：侧栏「设置」上方按钮升起/收起，位于内容区内不遮挡侧栏/顶栏，可拖拽调整高度（记忆在偏好），收起不中断会话。
- **里程碑页**：学习热力图（连续/最长天数）+ 学习曲线（累计学习天数）+ 成就。
- **成就系统**：23 个带名字的成就，可展开看任务/进度/达成时间；解锁时右下角弹提示（去重、首启静默基线）。逻辑在 `packages/web/src/achievements.ts`，埋点在 `packages/web/src/events.ts`。
- **能力地图四维进度条**：掌握 / 投入 / 持续 / 热度（替代百分比）。
- **Tooltip 统一**（`data-tip`），侧栏展开时不显示悬停提示。
- 对话流式按帧合并渲染；修 `Modal` 抢焦点 bug。

## 待办（候选，均未开始）

1. **备份恢复 UI**：`.myblog/backups/` 已在存，但没有恢复入口（看 diff / 一键恢复）。做完可补回「观往知来」成就。
2. **对话健壮性**：长会话已按帧合并渲染，但仍未虚拟滚动；模型报错时没有「重试」按钮；历史不裁剪，超上下文会报错。
3. **测试**：新功能（成就/插件/终端 dock/里程碑）缺组件测试；`tools.test.ts`、`config.test.ts` 建临时目录不清理（每次 `npm test` 堆 `%TEMP%`）。
4. **真 bug（潜在）**：`DailyView` 把总结文件名写死 `SUMMARY.md`，自定义 `summaryFile` 的工作区会写错链接。
5. **成就作用域**：目前成就用全局 localStorage，不区分工作区（建议加 root 前缀）。
6. **安全**：写操作硬闸门、`createApi` 隔离选项、key 用 `safeStorage`；插件无沙箱（`permissions` 未强制）。
7. **引导去重**：首启向导与概览「开始使用」在选库/配模型上重复。
8. 代码签名（消 SmartScreen）、winget/Scoop 收录、README GIF。
9. 清理 `D:\Work\Test_1` 的历史残留（该工作区已不在白名单）。

## 已知坑（务必知道）

- **打包顺序**：`npm run build` → `npm run build --workspace @myblog/desktop` → 在 `packages/desktop` 下 `npx electron-builder --win --dir|portable|nsis`。根 `build` **不含** Electron main。
- **打包走镜像**（直连 GitHub 下 Electron/工具会被重置）：
  `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; $env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"`
- 打包前**先关掉正在运行的 MyBlog**。
- **不要**把「模型配置」设成目录或盘符根（会 `EPERM`）；「历史目录」必须是目录。
- opencode `go` 网关必须带 `x-opencode-session` 头（代码已自动加）；`grok-4.6` 不可用，选 `deepseek-v4-flash` 这类。
- 工作区文件名：`PROGRESS.md` / `GOALS.md` / `SUMMARY.md`（旧 `总结.md` 首次读取自动迁移）。
- 冒烟：`$env:MYBLOG_DESKTOP_SMOKE="1"` + `$env:MYBLOG_DESKTOP_ROOT="<学习库>"` 启动 exe 打印 `SMOKE_OK`；`= "pty"` 验终端；`MYBLOG_DESKTOP_EVAL="<js>"` 在渲染进程执行表达式。
- 本机关键路径：学习库 `D:\Mobile`；应用数据 `%APPDATA%\@myblog\desktop`；GitHub 推送常被重置，用
  `git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push`。

## 验证命令

```bash
npm run build && npm run typecheck && npm run typecheck:test && npm test
```

## 新会话怎么开口（示例）

> 读 `AGENTS.md` 和 `docs/STATUS.md` 的「待办」，我们来挑第 N 条一起做。

（要发新版本时：改完 → `npm run version:bump -- x.y.z` 并补 CHANGELOG → commit/push → 打 `vx.y.z` tag 推送，CI 会 build 并建草稿 Release，再补说明并发布。）
