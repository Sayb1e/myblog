# 贡献指南

感谢参与 MyBlog。本文说明开发环境、约定与提交流程。

## 环境

- Node.js **>= 20.19**（推荐 22 / 24）
- npm（本仓库使用 npm workspaces，不使用 pnpm）

```bash
git clone https://github.com/Sayb1e/myblog
cd myblog
npm install
npm run build
```

## 常用命令

```bash
npm run build            # core → agent → server → cli → web
npm run typecheck        # 四包类型检查
npm run typecheck:test   # 测试代码类型检查
npm test                 # vitest 单测
npm run app              # 构建全部并启动桌面端（Electron）
```

桌面端额外步骤见根 `AGENTS.md`（`node-pty` 原生模块需要 `npm run fix:native --workspace @myblog/desktop`）。

## 提交前

- `npm run typecheck && npm run typecheck:test && npm test` 必须全绿。
- 新增/修改逻辑要补对应的 vitest 用例。
- 面向用户可见的改动，**必须 bump 版本并更新 `CHANGELOG.md`**：
  ```bash
  npm run version:bump -- 0.1.11
  # 然后补充 CHANGELOG.md 中 [0.1.11] 的内容
  ```
  版本规则：0.x 表示测试/预发布阶段；所有包版本保持一致。

## 代码风格

- ESM，相对导入带 `.js` 后缀；使用 `interface`；小函数。
- 不加多余注释；沿用现有命名与结构。
- 写回 markdown 时只替换目标段落/表格行，绝不整篇重新序列化；幂等、可 diff、保持原有行尾。

## 提交信息

沿用 Conventional Commits 风格，例如：

```
feat(web): add terminal view
fix(core): keep line endings on write-back
docs: update README quick start
```

## Pull Request

- 一个 PR 聚焦一件事，说明「做了什么 / 为什么 / 怎么验证」。
- 关联相关 issue。
- 等待 CI（ubuntu/windows × node 22/24）通过。

## 许可证

贡献即表示同意以 [MIT](./LICENSE) 许可发布你的改动。
