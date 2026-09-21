# AGENTS.md

MyBlog 仓库的开发约定。给在本仓工作的 AI/人类协作者。

## 结构

```
packages/core      解析/生成/校验/组装（唯一引擎，无 LLM、无 DB）
packages/agent     OpenAI 兼容模型客户端 + 工具循环（唯一持 key）
packages/cli       myblog 命令（status/today/context/scaffold/close/check/init/mcp）
packages/server    Hono API + SSE（/api/chat、/api/events），桌面端内置使用
packages/web       Vite + React 界面（由桌面端加载）
packages/desktop   Electron：内置 server + 真终端（node-pty）
```

> 形态是**桌面应用 + CLI**，不再支持「用浏览器打开」这条路径。

## 命令

```bash
npm run build          # core → agent → server → cli → web
npm run typecheck
npm run typecheck:test
npm test
npm run desktop        # 构建 main 并启动 Electron（需先 build 过 web）
npm run app            # build 全部 + 启动 Electron
```

## 版本规则（重要）

- **1.x 起为正式版本**（历史上的 0.x 为测试/预发布阶段）。
- **每次产生用户可见改动，都要 bump 版本，并保持所有包一致：**
  ```bash
  npm run version:bump -- 1.0.1
  ```
- bump 时会在根 `CHANGELOG.md` 自动插入 `## [x.y.z]` 占位条目，**必须补充内容**（改成实际改动）。
- 桌面打包后，`CHANGELOG.md` 会自动复制到 `packages/desktop/release/`，与 exe 放一起。
- 不要手写版本号到代码里。CLI/MCP 的版本从各自 `package.json` 读取（`packages/cli/src/version.ts`），桌面端用 `app.getVersion()`。
- 打包后的桌面文件名会带版本号（如 `MyBlog 1.0.0.exe`）。

## 写回原则

- 只替换目标段落/表格行，绝不整篇重新序列化。
- 幂等、可 diff；保持原文件行尾（LF/CRLF）。
- 写操作默认先 dry-run 出 diff，用户确认后再落盘。

## 代码风格

- ESM，相对导入带 `.js` 后缀；用 `interface`；小函数。
- 不加多余注释；沿用现有命名与结构。
- 新增/修改逻辑要补对应 vitest 用例（core/agent/cli/web 都有测试）。

## 桌面端注意

- electron 二进制可能被 npm allow-scripts 策略拦截；用镜像补装：
  `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; node node_modules/electron/install.js`
- `node-pty` 是原生模块，且 `binding.gyp` 默认要求 Spectre 库（VS 未装会编译失败）。跑一次
  `npm run fix:native --workspace @myblog/desktop`（内部会关掉 Spectre 要求并针对 Electron 重编）。
- 打包：`$env:ELECTRON_BUILDER_BINARIES_MIRROR="..." ; npx electron-builder --win portable`（在 `packages/desktop` 下）。
- 终端用 winpty 后端（`useConpty: false`），ConPTY 的 console-list 辅助进程在 Electron 下会崩。
