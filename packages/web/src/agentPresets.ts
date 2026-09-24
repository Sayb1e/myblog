export interface AgentPreset {
  id: string;
  label: string;
  baseURL: string;
  model: string;
}

export const AGENT_PRESETS: AgentPreset[] = [
  { id: "opencode-go", label: "OpenCode Go", baseURL: "https://opencode.ai/zen/go/v1", model: "deepseek-v4-flash" },
  { id: "opencode-zen", label: "OpenCode Zen", baseURL: "https://opencode.ai/zen/v1", model: "glm-4.7" },
  { id: "openai", label: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "deepseek", label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { id: "dashscope", label: "通义千问", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { id: "moonshot", label: "Kimi / Moonshot", baseURL: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  { id: "zhipu", label: "智谱 GLM", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { id: "openrouter", label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  { id: "ollama", label: "本地 Ollama", baseURL: "http://127.0.0.1:11434/v1", model: "qwen2.5" },
  { id: "custom", label: "自定义", baseURL: "", model: "" },
];
