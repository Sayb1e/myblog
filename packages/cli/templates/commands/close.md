用户输入（可选）：$ARGUMENTS

目标：把今天的结果写进工作区（`YYYY-MM-DD/总结.md` 与 `PROGRESS.md`），所有写操作可 diff、幂等。

步骤：

1. 读上下文：MCP 工具 `myblog_context`（未接入 MCP 时退回 `myblog status --json`）。
2. 和用户确认四件事，信息不足先问，不要编造：
   - 今天做了什么（did）
   - 学到哪了（learned，一句话）
   - 下次从哪继续（next，一句话）
   - 涉及的 G 编号
3. 生成/更新当日总结：用 MCP 工具 `myblog_scaffold`（date / preview / next / skills）。若文件已存在，用编辑工具只在 `## 这次` 段补内容，不要整篇重写。
4. 先预览：用 MCP 工具 `myblog_close`（默认 `dryRun=true`）拿 diff。给用户看改动，确认后再以 `dryRun=false` 写回。
5. 收尾用 MCP 工具 `myblog_check`，确认没有断链、未定义编号、根目录附件。
6. 写回必须是外科手术式：只替换目标段落/表格行，绝不整篇重新序列化；不要改动与今天无关的内容。
