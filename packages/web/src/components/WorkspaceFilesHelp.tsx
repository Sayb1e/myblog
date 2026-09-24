const OVERVIEW_SAMPLE = `# 学习总览

## 现在学到哪了
学到哪了：会用 adb 连真机，跑通了第一个 Hook。
下次从哪继续：把 Frida 注入脚本跑通。

## 学习记录
| 日期 | 这次做了什么 | 链接 |
|---|---|---|
| 2026-09-22 | 配好环境，跑通 Hello World | 2026-09-22/SUMMARY.md |`;

const GOALS_SAMPLE = `# 学习目标

## 能力编号
| 编号 | 能力 | 要能回答什么 | 当前状态 |
|---|---|---|---|
| G1 | 环境 | 工具与环境是否可用 | 已闭环 |
| G2 | 基础 | 核心概念与最小闭环 | 进行中 |`;

export function WorkspaceFilesHelp() {
  return (
    <div className="files-help">
      <p className="muted">MyBlog 靠学习库根目录下的两个 Markdown 文件工作：</p>
      <div className="files-help-list">
        <div className="files-help-item">
          <code>PROGRESS.md</code>
          <span className="muted">
            <strong>必需</strong> · 学习进度总览：现在学到哪、下次从哪继续、每日记录表。
          </span>
          <details className="files-help-sample-wrap">
            <summary>看样例</summary>
            <pre className="files-help-sample">{OVERVIEW_SAMPLE}</pre>
          </details>
        </div>
        <div className="files-help-item">
          <code>GOALS.md</code>
          <span className="muted">
            <strong>可选（推荐）</strong> · 学习目标与能力地图：G1/G2… 的要回答的问题与当前状态。
          </span>
          <details className="files-help-sample-wrap">
            <summary>看样例</summary>
            <pre className="files-help-sample">{GOALS_SAMPLE}</pre>
          </details>
        </div>
      </div>
      <p className="muted">「初始化结构」会按模板生成这两个文件，之后直接在「文件」里改就行，格式不用背。</p>
    </div>
  );
}
