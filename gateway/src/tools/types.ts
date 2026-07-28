export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>, env?: any) => Promise<ToolResult>
  category: 'web' | 'filesystem' | 'github' | 'obsidian' | 'shell' | 'browser' | 'database'
  localOnly: boolean
}

export interface ToolResult {
  success: boolean
  data: unknown
  error?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ToolChoice {
  role: 'assistant'
  content: string | null
  tool_calls?: ToolCall[]
}

// Convierte nuestras tools al formato OpenAI (compatible con DeepSeek, OpenRouter, Groq)
export function toOpenAiTools(tools: ToolDefinition[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}
