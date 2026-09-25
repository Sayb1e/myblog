# 项目状态与交接（给 AI / 协作者）

**新会话请按这个顺序读**：`AGENTS.md`（约定与命令）→ 本文件（当前进度 / 待办 / 已知坑）→ `CHANGELOG.md`（已发布内容）→ `README.md`（产品说明）。

## 当前版本

| 项 | 状态 |
| --- | --- |
| package 版本 | **1.3.1**（含终端 dock / 里程碑页 / 成就系统等；本地 `win-unpacked` 已更新） |
| 最近已发布 | **v1.3.1**（GitHub Release：`MyBlog_v1.3.1_setup.exe` + `_portable.exe` + `SHA256SUMS.txt`；主分支与 tag 均已推送） |
| 待发布 | 无（下次有用户可见改动时 bump 并 tag） |
| 本地产物 | `packages/desktop/release/win-unpacked/MyBlog.exe`（1.3.1）；旧的 1.2.x 产物已删 |

## 1.3.1 已完成（已发布）

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
