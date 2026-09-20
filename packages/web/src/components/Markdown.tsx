import { createContext, useContext, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { usePrefs } from "../prefs.js";
import { CodeBlock, extractCode } from "./CodeBlock.js";

const MarkdownContext = createContext<{ openDate?: (date: string) => void }>({});

export function MarkdownProvider({ openDate, children }: { openDate: (date: string) => void; children: ReactNode }) {
  return <MarkdownContext.Provider value={{ openDate }}>{children}</MarkdownContext.Provider>;
}

function dateFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const match = /(\d{4}-\d{2}-\d{2})/.exec(href);
  return match?.[1] ?? null;
}

function balanceFences(text: string): string {
  const fences = (text.match(/^```/gm) ?? []).length;
  return fences % 2 === 1 ? `${text}\n\`\`\`` : text;
}

interface Props {
  children: string;
  inline?: boolean;
}

export function Markdown({ children, inline }: Props) {
  const { openDate } = useContext(MarkdownContext);
  const { prefs } = usePrefs();

  const components: Components = {
    pre: ({ children }) => {
      const child = Array.isArray(children) ? children[0] : children;
      const className =
        (child as { props?: { className?: string } } | null)?.props?.className ?? "";
      const language = /language-([\w-]+)/.exec(className)?.[1] ?? "";
      return (
        <CodeBlock language={language} code={extractCode(children)}>
          {children}
        </CodeBlock>
      );
    },
    a: ({ href, children: label }) => {
      const date = dateFromHref(href);
      if (date && openDate) {
        return (
          <button
            type="button"
            className="md-link"
            onClick={(event) => {
              event.stopPropagation();
              openDate(date);
            }}
          >
            {label}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          {label}
        </a>
      );
    },
  };

  if (inline) {
    components.p = ({ children: content }: { children?: ReactNode }) => <>{content}</>;
  }

  const body = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={prefs.codeHighlight ? [rehypeHighlight] : []}
      components={components}
    >
      {balanceFences(children)}
    </ReactMarkdown>
  );

  return inline ? <span className="md inline">{body}</span> : <div className="md">{body}</div>;
}
