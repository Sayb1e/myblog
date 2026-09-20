import { useState, type ReactNode } from "react";

function nodeText(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in (node as { props?: { children?: unknown } })) {
    return nodeText((node as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

export function extractCode(children: ReactNode): string {
  return nodeText(children).replace(/\n$/, "");
}

interface Props {
  language: string;
  code: string;
  children: ReactNode;
}

export function CodeBlock({ language, code, children }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang">{language || "text"}</span>
        <button type="button" className="code-copy" onClick={() => void copy()}>
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}
