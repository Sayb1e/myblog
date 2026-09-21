interface Props {
  open: boolean;
  onClose: () => void;
}

const ROWS: [string, string][] = [
  ["Ctrl / Cmd + K", "命令面板"],
  ["?", "显示 / 隐藏快捷键帮助"],
  ["Esc", "关闭浮层"],
  ["Enter / Shift+Enter", "对话中发送 / 换行"],
  ["点进度字段", "就地编辑"],
];

export function ShortcutHelp({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <strong>快捷键</strong>
          <span className="palette-kbd" style={{ marginLeft: "auto" }}>
            Esc
          </span>
        </div>
        <div className="palette-list">
          {ROWS.map(([key, label]) => (
            <div key={key} className="shortcut-row">
              <kbd>{key}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
