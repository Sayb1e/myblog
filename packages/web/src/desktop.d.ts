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

  interface Window {
    myblog?: {
      desktop?: boolean;
      pickDirectory?: () => Promise<string | null>;
      terminal?: MyBlogTerminalApi;
    };
  }
}
