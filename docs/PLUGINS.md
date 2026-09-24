# 插件开发

MyBlog 支持外部插件：把一个插件目录放进**应用数据目录**的 `plugins/` 下，重启应用即可加载。

插件可以贡献三类能力：

| 能力 | 作用 | 在应用里的入口 |
| --- | --- | --- |
| `commands` | 命令面板命令 | `Ctrl+K` 搜命令 → 执行 |
| `tools` | agent 工具（模型可调用） | 对话时模型自行调用 |
| `handlers` | 后端接口（IPC dispatch） | 供插件命令 / 其它代码调用 |

> ⚠️ 目前**没有沙箱**：插件入口在主进程里以普通 Node 模块运行，等于完全信任。只安装你信任的插件。

## 插件放在哪

- Windows：`%APPDATA%\@myblog\desktop\plugins\<插件id>\`
- macOS：`~/Library/Application Support/@myblog/desktop/plugins/<插件id>/`
- Linux：`~/.config/@myblog/desktop/plugins/<插件id>/`

每个插件一个子目录，结构：

```
plugins/
└── hello/
    ├── plugin.json     # 清单（必需）
    └── index.mjs       # 入口（默认，可被 plugin.json 的 main 覆盖）
```

改完插件后需要**重启应用**（当前在启动时加载一次，无热重载）。

## plugin.json

```json
{
  "id": "hello",
  "name": "示例插件",
  "version": "1.0.0",
  "description": "一句话说明。",
  "main": "index.mjs",
  "permissions": []
}
```

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `id` | 否 | 唯一标识；缺省用目录名。命令 id 会加前缀 `id.` |
| `name` | 否 | 显示名，缺省用 `id` |
| `version` / `description` | 否 | 展示用 |
| `main` | 否 | 入口文件，默认 `index.mjs` |
| `permissions` | 否 | 权限声明，**当前仅作说明，未强制** |

## 入口（默认导出）

`index.mjs` 默认导出一个对象：

```js
export default {
  commands: [
    {
      id: "greet",              // 实际命令 id 会变成 "hello.greet"
      title: "打个招呼",
      hint: "插件",             // 命令面板右侧提示（可选）
      run: async (ctx) => ({ message: `工作区：${ctx.root}` }),
    },
  ],

  tools: [
    {
      name: "hello_now",        // 建议加插件前缀，避免和内置工具重名
      description: "返回当前时间",
      // JSON Schema（OpenAI function 参数格式）
      parameters: { type: "object", properties: {}, additionalProperties: false },
      run: async (args, ctx) => ({ now: new Date().toISOString() }),
    },
  ],

  handlers: {
    // 可直接被 IPC dispatch 调用：window.myblog.api.invoke("helloPing", payload)
    helloPing: async (payload, ctx) => ({ pong: true, payload }),
  },
};
```

### 上下文 `ctx`

每个回调都会拿到：

```ts
{ root: string, pluginId: string }
```

`root` 是**当前工作区根目录**（绝对路径）。读写文件、调用外部命令等由插件自己用 Node API 完成。

### 各能力的约定

- **commands**：`run(ctx)` 的返回值只用于日志/成功提示；不直接操作 UI。需要输入的话，建议另配一个 handler，命令里 `fetch`/`invoke` 调用。
- **tools**：`parameters` 是标准 JSON Schema；`run(args, ctx)` 的返回值会作为工具结果回给模型（会自动 `JSON.stringify`）。工具名请保持唯一，避免与内置工具（`myblog_*` / `fs_*`）冲突。
- **handlers**：名字唯一；会并入接口表，可直接 `invoke("你的handler名", payload)`。不能覆盖内置接口名。

## 最小完整示例

`plugins/hello/plugin.json`

```json
{ "id": "hello", "name": "示例插件", "version": "1.0.0", "main": "index.mjs" }
```

`plugins/hello/index.mjs`

```js
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export default {
  commands: [
    {
      id: "stamp",
      title: "在根目录写一个时间戳文件",
      hint: "插件",
      run: async (ctx) => {
        const file = path.join(ctx.root, ".myblog-hello.txt");
        await writeFile(file, new Date().toISOString(), "utf8");
        return { file };
      },
    },
  ],
  tools: [
    {
      name: "hello_read",
      description: "读取工作区内某个文本文件（示例）",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
      run: async (args, ctx) => ({ content: await readFile(path.join(ctx.root, String(args.path)), "utf8") }),
    },
  ],
  handlers: {
    helloPing: async (payload) => ({ pong: true, payload }),
  },
};
```

## 调试

- 加载失败时，**设置 → 插件** 里会在该插件下显示「加载失败：…」（语法错误、入口缺失等）。
- 插件命令执行失败会在界面弹出错误提示。
- 想看日志可以在 `run` 里 `console.log`（会打到主进程控制台）。

## 当前限制 / 路线

1. **无沙箱、无权限强制**：`permissions` 只是声明。后续可加白名单 API、默认禁用网络/文件、显式授权。
2. **无热重载**：改完要重启应用。
3. **无 TypeScript 类型包**：现在按本文档手写即可；后续可发 `@myblog/plugin-types`。
4. **无脚手架**：后续可加 `myblog plugin new <id>` 生成模板。
5. **不做 UI 注入**：v1 只开放命令 / 工具 / handler 三类，不允许插件注入任意界面。
