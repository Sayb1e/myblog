## MyBlog 学习循环

本仓库由 MyBlog 管理（一个基于 markdown 的学习工作区）。开始任何学习相关任务前：

- 用 MCP 工具 `myblog_context` 获取状态、校验结果与最近总结（未接入 MCP 时退回 `myblog status --json`）；只信它的输出，不要臆造进度。
- 今日任务 = 「下次从哪继续」∩ 当前阶段 G 能力（`active`）；不要提前开后面的阶段，主线未闭环不并新阶段。
- 每日细节写在 `YYYY-MM-DD/SUMMARY.md`，并在 `## 这次` 里标当天碰到的 G 编号；当天的工程/脚本/APK 放进 `YYYY-MM-DD/` 子目录。
- 有进展才生成：当天没有实际进展就不建日期目录/当日总结、不写 `PROGRESS.md`（同理，没进展不 `myblog_close`）。
- 收工：先 `myblog_close`（默认 `dryRun=true`）看 diff，确认后再以 `dryRun=false` 落盘，最后 `myblog_check`。
- 普通文件（脚本、代码、笔记）用 `fs_list` / `fs_read` / `fs_write`，路径一律相对工作区根目录；写入同样先给 diff 让用户确认。
- 写回只替换目标段落或表格行，绝不整篇重写；所有写操作幂等、可 diff。

桌面端 MyBlog 应用可查看阶段 / 能力地图 / 时间线 / 对话 / 终端。
