import type { AgentEvent, ApiMethod, ApiPayload, ApiResult } from "@myblog/server";

export {};

declare global {
  interface MyBlogTerminalApi {
    create(options: { cwd?: string; cols?: number; rows?: number }): Promise<{ id: number; shell: string }>;
    write(id: number, data: string): void;
    resize(id: number, cols: number, rows: number): void;
    kill(id: number): void;
    onData(listener: (payload: { id: number; data: string }) => void): void;
    onExit(listener: (payload: { id: number }) => void): void;
    removeAllListeners(): void;
  }

  interface MyBlogApiBridge {
    invoke<M extends ApiMethod>(method: M, payload?: ApiPayload<M>): Promise<ApiResult<M>>;
    chat(payload: {
      streamId: string;
      messages: { role: "user" | "assistant"; content: string }[];
    }): Promise<void>;
    cancelChat(streamId: string): void;
    onChatEvent(listener: (payload: { streamId: string; event: AgentEvent }) => void): () => void;
    onFsChange(listener: () => void): () => void;
  }

  interface Window {
    myblog?: {
      desktop?: boolean;
      state?: () => Promise<{ ready: boolean; root: string }>;
      setupWorkspace?: (path: string) => Promise<{ root: string }>;
      createSampleWorkspace?: (parent: string) => Promise<{ root: string }>;
      pickDirectory?: () => Promise<string | null>;
      absolutePath?: (relative: string) => Promise<string>;
      reveal?: (relative: string) => void;
      setTheme?: (theme: "dark" | "light" | "system") => void;
      windowControls?: {
        minimize: () => void;
        toggleMaximize: () => void;
        close: () => void;
        onMaximized: (listener: (maximized: boolean) => void) => void;
      };
      api?: MyBlogApiBridge;
      terminal?: MyBlogTerminalApi;
    };
  }
}
