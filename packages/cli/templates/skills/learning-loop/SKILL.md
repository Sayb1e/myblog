---
name: learning-loop
description: Use when working in a markdown learning workspace managed by MyBlog (files like 学习进度总览.md, 岗位目标.md, YYYY-MM-DD/总结.md, or myblog.config.json). Triggers on "今天学什么", "今天该干什么", "下次从哪继续", "上次停在哪", "收工", "写总结", "学习进度", "G 阶段/G 编号". Use ONLY for managing that workspace; not for general coding.
---

# Learning loop

MyBlog 管理一个「人可改、可 git」的 markdown 学习仓。markdown 是唯一数据源，没有数据库。core 不调用任何 LLM：解析、校验、写回由 core 与桌面端负责，判断「今天干什么」由你来做。

## 先确认工作区

仓库根目录应存在 `学习进度总览.md` 与 `岗位目标.md`（名称可用 `myblog.config.json` 覆盖）。找不齐就先问用户工作区路径，别猜。

## 入口

优先用 MCP 工具（`myblog mcp` 已注册时）：

```text
myblog_context      # 一次拿到：状态 + 今日 + 校验 + 最近总结（agent 主入口）
myblog_check        # 校验编号/链接/日期目录/根目录附件
myblog_read_summary # 读某天 YYYY-MM-DD/总结.md
myblog_scaffold     # 建当日总结骨架（不覆盖）
myblog_close        # 写回总览（默认 dryRun=true，先看 diff）
fs_list/fs_read/fs_write  # 工作区内的普通文件
```

没接入 MCP 时退回 CLI：`myblog status --json`（`myblog` 不在 PATH 就用桌面端 MyBlog 应用，或 `node packages/cli/dist/index.js status --json`）。

## 循环

1. **读**：`myblog_context`。只信工具输出，不臆造。
2. **定任务**：今日任务 = 「下次从哪继续」∩ 当前阶段 G 能力。不要因为岗位目标里写了脱壳/AOSP/CVE 就提前开线；主线未闭环不并新阶段。
3. **做**：按用户确认的方案执行学习内容（这是唯一由你与用户共同推进的部分）。
4. **记**：在 `YYYY-MM-DD/总结.md` 的 `## 这次` 里标当天碰到的 G 编号（可多个，只标真正碰到的）。当天新建的工程/脚本/APK 放进 `YYYY-MM-DD/` 子目录。
5. **收工**：先 `myblog_close`（`dryRun=true`）给用户看 diff，确认后再以 `dryRun=false` 落盘；最后 `myblog_check`。

## 硬约束

- 写回只替换目标段落或表格行，绝不整篇重新序列化（否则 diff 与中文表格会乱）。
- 所有写操作幂等、可 diff；重复执行不应产生重复记录。
- 不修改与被今天无关的内容；不把 `岗位目标.md` 抄进每日总结。
- 每日总结是细节唯一来源；总览只放「学到哪了 / 下次从哪继续 / 最近一次 / 学习记录」。
