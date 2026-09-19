## MyBlog 学习循环

本仓库由 MyBlog 管理（一个基于 markdown 的学习工作区）。开始任何学习相关任务前：

- 先运行 `myblog context --json`（不可用时 `node packages/cli/dist/index.js context --json`）获取状态、今日上下文、校验结果与最近总结；只信它的输出，不要臆造进度。
- 今日任务 = 「下次从哪继续」∩ 当前阶段 G 能力（`active`）；不要提前开后面的阶段，主线未闭环不并新阶段。
- 每日细节写在 `YYYY-MM-DD/总结.md`，并在 `## 这次` 里标当天碰到的 G 编号；当天的工程/脚本/APK 放进 `YYYY-MM-DD/` 子目录。
- 收工：先 `myblog close ... --dry-run` 看 diff，确认后再落盘，最后 `myblog check`。
- 写回只替换目标段落或表格行，绝不整篇重写；所有写操作幂等、可 diff。

`myblog serve` 可打开本地仪表盘（阶段 / 能力地图 / 时间线 / 总结编辑）。
