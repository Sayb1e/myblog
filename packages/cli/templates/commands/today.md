调用 MyBlog 读取工作区上下文，然后给出今日建议。用户补充（可选）：$ARGUMENTS

步骤：

1. 先用 MCP 工具 `myblog_context` 获取上下文（未接入 MCP 时退回 `myblog status --json`；`myblog` 不在 PATH 就用桌面端 MyBlog 应用）。
2. 只把返回的 JSON 当作事实依据（`stage`、`stageIds`、`active`、`next`、`lastDate`、`lastNext`、`lastSkills`、`progress`、`records`、`check`），不要臆造进度或能力状态。
3. 把「下次从哪继续」（`next`）与当前阶段能力（`active`）取交集，给出 1–3 条今天可执行的具体动作，每条附验证方式（怎么算做完）。
4. 用一句话说明上次停在哪、这次的第一件事是什么。
5. 只给方案，不执行学习内容、不修改任何工作区文件；等用户确认。
