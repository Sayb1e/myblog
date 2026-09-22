import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, listFiles, readWorkspaceFile, type FileContent, type FileEntry, type FileListing } from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { usePrefs } from "../prefs.js";
import { IconArrowLeft, IconCopy, IconFile, IconFolder, IconRefresh } from "./icons.js";
import { Markdown } from "./Markdown.js";

interface Props {
  root: string;
}

const MARKDOWN = /\.(md|markdown|mdx)$/i;

const CODE_LANG: Record<string, string> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".cjs": "js",
  ".json": "json",
  ".java": "java",
  ".kt": "kotlin",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".hpp": "cpp",
  ".cs": "cs",
  ".py": "python",
  ".ps1": "powershell",
  ".sh": "bash",
  ".bash": "bash",
  ".bat": "bat",
  ".cmd": "bat",
  ".xml": "xml",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".ini": "ini",
  ".sql": "sql",
  ".rs": "rust",
  ".go": "go",
  ".gradle": "groovy",
  ".properties": "",
};

function extension(path: string): string {
  const index = path.lastIndexOf(".");
  return index < 0 ? "" : path.slice(index).toLowerCase();
}

function fence(content: string, lang: string): string {
  const ticks = content.includes("```") ? "````" : "```";
  return `${ticks}${lang}\n${content}\n${ticks}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function segments(path: string): { label: string; path: string }[] {
  if (path === "" || path === ".") return [];
  const parts = path.split("/").filter(Boolean);
  return parts.map((part, index) => ({ label: part, path: parts.slice(0, index + 1).join("/") }));
}

export function FilesView({ root }: Props) {
  const { prefs } = usePrefs();
  const toast = useToast();
  const [path, setPath] = useState("");
  const [listing, setListing] = useState<FileListing | null>(null);
  const [file, setFile] = useState<FileContent | null>(null);
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const workspace = root ? root.split(/[\\/]/).filter(Boolean).pop() ?? "" : "";
  const markdown = file ? MARKDOWN.test(file.path) : false;
  const code = file ? CODE_LANG[extension(file.path)] : undefined;
  const highlight = file ? markdown || code !== undefined : false;

  useEffect(() => {
    setMode("preview");
  }, [file?.path]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenu(null);
    };
    const onScroll = (): void => setMenu(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  const load = useCallback(async (target: string): Promise<void> => {
    setLoading(true);
    try {
      setListing(await listFiles(target));
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(path);
  }, [load, path]);

  useEffect(() => {
    const api = window.myblog?.api;
    if (!api || !prefs.liveRefresh) return;
    return api.onFsChange(() => {
      void load(path);
    });
  }, [load, path, prefs.liveRefresh]);

  const openFile = async (target: string): Promise<void> => {
    try {
      setFile(await readWorkspaceFile(target));
      setError("");
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

  const copy = async (): Promise<void> => {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.dataUrl ? file.path : file.content);
      toast("success", file.dataUrl ? "已复制路径" : "已复制文件内容");
    } catch {
      toast("error", "复制失败");
    }
  };

  const copyPath = async (entry: FileEntry, absolute: boolean): Promise<void> => {
    try {
      const value = absolute ? (await window.myblog?.absolutePath?.(entry.path)) ?? entry.path : entry.path;
      await navigator.clipboard.writeText(value);
      toast("success", absolute ? "已复制完整路径" : "已复制相对路径");
    } catch {
      toast("error", "复制失败");
    } finally {
      setMenu(null);
    }
  };

  const row = (entry: FileEntry) => (
    <li key={entry.path}>
      <button
        type="button"
        className={`file-row${file?.path === entry.path ? " active" : ""}`}
        onClick={() => (entry.type === "dir" ? setPath(entry.path) : void openFile(entry.path))}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY, entry });
        }}
      >
        <span className={`file-icon ${entry.type}`}>{entry.type === "dir" ? <IconFolder /> : <IconFile />}</span>
        <span className="file-name">{entry.name}</span>
        <span className="file-size muted">{entry.type === "dir" ? "目录" : formatSize(entry.size)}</span>
      </button>
    </li>
  );

  return (
    <div className="files-layout">
      <section className="card files-tree">
        <div className="card-head">
          <h2>文件</h2>
          <button type="button" className="ghost icon-btn sm" aria-label="刷新" data-tip="刷新" onClick={() => void load(path)}>
            <IconRefresh />
          </button>
        </div>

        <div className="files-crumbs">
          <button
            type="button"
            className={`crumb${path === "" ? " current" : ""}`}
            onClick={() => setPath("")}
            title={root}
          >
            {workspace || "工作区"}
          </button>
          {segments(path).map((segment) => (
            <span key={segment.path} className="crumb-group">
              <span className="crumb-sep">/</span>
              <button
                type="button"
                className={`crumb${segment.path === path ? " current" : ""}`}
                onClick={() => setPath(segment.path)}
              >
                {segment.label}
              </button>
            </span>
          ))}
        </div>

        {path !== "" && (
          <button type="button" className="ghost files-up" onClick={() => setPath(parent)}>
            <IconArrowLeft /> 上一级
          </button>
        )}

        {error && <p className="muted">{error}</p>}
        {!error && loading && !listing && <p className="muted">读取中…</p>}
        {!error && listing && listing.entries.length === 0 && <p className="muted">这个目录是空的</p>}

        {!error && listing && listing.entries.length > 0 && (
          <ul className="files-list">{listing.entries.map(row)}</ul>
        )}
        {!error && listing?.truncated && <p className="muted">条目过多，只显示前 500 项。</p>}
      </section>

      <section className="card files-preview">
        {file ? (
          <>
            <div className="card-head">
              <h2 title={file.path}>{file.path}</h2>
              <div className="files-preview-actions">
                {highlight && !file.binary && !file.dataUrl && (
                  <div className="seg compact">
                    {(
                      [
                        { id: "preview", label: "预览" },
                        { id: "source", label: "源码" },
                      ] as { id: "preview" | "source"; label: string }[]
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`seg-item${mode === option.id ? " active" : ""}`}
                        onClick={() => setMode(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                {(file.dataUrl || !file.binary) && (
                  <button
                    type="button"
                    className="ghost icon-btn sm"
                    aria-label="复制"
                    data-tip={file.dataUrl ? "复制路径" : "复制内容"}
                    onClick={() => void copy()}
                  >
                    <IconCopy />
                  </button>
                )}
              </div>
            </div>
            {file.dataUrl ? (
              <div className="file-image-wrap">
                <img className="file-image" src={file.dataUrl} alt={file.path} />
              </div>
            ) : file.binary ? (
              <p className="muted">这是二进制文件，暂不支持预览。</p>
            ) : (
              <>
                {file.truncated && <p className="muted">文件超过 256KB，只显示开头部分。</p>}
                {highlight && mode === "preview" ? (
                  <div className="markdown-preview">
                    <Markdown>{markdown ? file.content : fence(file.content, code ?? "")}</Markdown>
                  </div>
                ) : (
                  <pre className="file-content">{file.content}</pre>
                )}
              </>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-mark">
              <IconFile />
            </div>
            <h2>预览文件</h2>
            <p className="muted">从左侧选择文件查看内容；点目录进入下一层，右键可复制路径。</p>
          </div>
        )}
      </section>

      {menu && (
        <div className="file-menu" ref={menuRef} style={{ left: menu.x, top: menu.y }}>
          <div className="file-menu-title">{menu.entry.name}</div>
          <button type="button" onClick={() => void copyPath(menu.entry, false)}>
            复制相对路径
          </button>
          <button type="button" onClick={() => void copyPath(menu.entry, true)}>
            复制完整路径
          </button>
          <button
            type="button"
            onClick={() => {
              window.myblog?.reveal?.(menu.entry.path);
              setMenu(null);
            }}
          >
            在资源管理器中显示
          </button>
        </div>
      )}
    </div>
  );
}
