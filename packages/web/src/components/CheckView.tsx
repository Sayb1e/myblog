import type { CheckResult } from "@myblog/core";

interface Props {
  result: CheckResult;
}

export function CheckView({ result }: Props) {
  if (result.issues.length === 0) {
    return (
      <section className="card empty-state">
        <div className="empty-mark">✓</div>
        <h2>一切正常</h2>
        <p className="muted">G 编号、链接、日期目录、根目录附件都没有问题。</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>校验</h2>
        <span className={`chip ${result.ok ? "ok" : "bad"}`}>{result.ok ? "无错误" : "有错误"}</span>
      </div>
      <ul className="issues">
        {result.issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`} className={issue.level}>
            <span className={`level ${issue.level}`}>{issue.level === "error" ? "错误" : "警告"}</span>
            <span className="code">{issue.code}</span>
            <span className="message">{issue.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
