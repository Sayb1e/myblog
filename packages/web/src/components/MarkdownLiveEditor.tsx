import { useEffect, useRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  drawSelection,
  keymap,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { tags } from "@lezer/highlight";

interface Props {
  value: string;
  onChange: (markdown: string) => void;
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  override eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked;
  }
  override toDOM(): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = `cm-lp-task${this.checked ? " done" : ""}`;
    wrap.textContent = this.checked ? "☑" : "☐";
    return wrap;
  }
  override ignoreEvent(): boolean {
    return false;
  }
}

class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string) {
    super();
  }
  override eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt;
  }
  override toDOM(): HTMLElement {
    const img = document.createElement("img");
    img.className = "cm-lp-image";
    img.src = this.src;
    img.alt = this.alt;
    return img;
  }
}

const highlightStyle = HighlightStyle.define([
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--accent)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--faint)" },
  { tag: tags.monospace, fontFamily: "var(--mono)", background: "var(--inline-code)", borderRadius: "4px" },
  { tag: tags.heading1, fontSize: "1.6em", fontWeight: "700" },
  { tag: tags.heading2, fontSize: "1.4em", fontWeight: "700" },
  { tag: tags.heading3, fontSize: "1.22em", fontWeight: "650" },
  { tag: tags.heading4, fontSize: "1.1em", fontWeight: "650" },
  { tag: tags.processingInstruction, color: "var(--faint)" },
  { tag: tags.contentSeparator, color: "var(--faint)" },
]);

interface Item {
  from: number;
  to: number;
  value: Decoration;
}

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const active = new Set<number>();
  for (const range of state.selection.ranges) {
    const start = state.doc.lineAt(range.from).number;
    const end = state.doc.lineAt(range.to).number;
    for (let line = start; line <= end; line += 1) active.add(line);
  }

  const items: Item[] = [];
  const seen = new Set<string>();
  const hide = (from: number, to: number): void => {
    if (to <= from) return;
    if (state.doc.sliceString(from, to).includes("\n")) return;
    items.push({ from, to, value: Decoration.replace({}) });
  };
  const lineDeco = (line: number, cls: string): void => {
    const from = state.doc.line(line).from;
    const key = `${from}:${cls}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ from, to: from, value: Decoration.line({ class: cls }) });
  };

  syntaxTree(state).iterate({
    enter: (node) => {
      const name = node.name;
      const lineNo = state.doc.lineAt(node.from).number;
      const editing = active.has(lineNo);
      switch (name) {
        case "HeaderMark": {
          if (editing) break;
          const next = state.doc.sliceString(node.to, node.to + 1);
          hide(node.from, next === " " ? node.to + 1 : node.to);
          break;
        }
        case "EmphasisMark":
        case "StrongEmphasisMark":
        case "StrikethroughMark":
        case "QuoteMark":
        case "CodeMark":
        case "CodeInfo":
        case "LinkMark":
        case "URL":
          if (!editing) hide(node.from, node.to);
          break;
        case "FencedCode": {
          const start = state.doc.lineAt(node.from).number;
          const end = state.doc.lineAt(node.to).number;
          for (let line = start; line <= end; line += 1) lineDeco(line, "cm-lp-code");
          break;
        }
        case "Blockquote": {
          const start = state.doc.lineAt(node.from).number;
          const end = state.doc.lineAt(node.to).number;
          for (let line = start; line <= end; line += 1) lineDeco(line, "cm-lp-quote");
          break;
        }
        case "ATXHeading1":
        case "ATXHeading2":
        case "ATXHeading3":
        case "ATXHeading4":
        case "ATXHeading5":
        case "ATXHeading6":
          lineDeco(lineNo, `cm-lp-h${name.slice(-1)}`);
          break;
        case "TaskMarker": {
          if (editing) break;
          const checked = /\[[xX]\]/.test(state.doc.sliceString(node.from, node.to));
          items.push({ from: node.from, to: node.to, value: Decoration.replace({ widget: new CheckboxWidget(checked) }) });
          break;
        }
        case "Image": {
          if (editing) break;
          const text = state.doc.sliceString(node.from, node.to);
          const match = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/.exec(text);
          if (match) {
            items.push({
              from: node.from,
              to: node.to,
              value: Decoration.replace({ widget: new ImageWidget(match[2] as string, match[1] ?? "") }),
            });
          }
          break;
        }
        case "Table": {
          const start = state.doc.lineAt(node.from).number;
          const end = state.doc.lineAt(node.to).number;
          for (let line = start; line <= end; line += 1) lineDeco(line, "cm-lp-table");
          break;
        }
        case "HorizontalRule":
          lineDeco(lineNo, "cm-lp-hr");
          break;
        default:
          break;
      }
    },
  });

  return Decoration.set(items, true);
}

const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (value) => value.decorations },
);

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "14px", color: "var(--text)", backgroundColor: "transparent" },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--font)",
    lineHeight: "1.7",
    padding: "12px 16px",
  },
  ".cm-content": { padding: "0", caretColor: "var(--accent)" },
  ".cm-gutters": { display: "none" },
  "&.cm-focused": { outline: "none" },
  ".cm-line": { padding: "1px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "rgba(var(--accent-rgb), 0.22)",
  },
});

export function MarkdownLiveEditor({ value, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialRef = useRef(value);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const extensions: Extension[] = [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(highlightStyle),
      livePreview,
      theme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChangeRef.current(update.state.doc.toString());
      }),
      EditorView.contentAttributes.of({ spellcheck: "false", autocapitalize: "off" }),
    ];
    const view = new EditorView({
      state: EditorState.create({ doc: initialRef.current, extensions }),
      parent: host,
    });
    return () => view.destroy();
  }, []);

  return <div className="cm-live-host" ref={hostRef} />;
}
