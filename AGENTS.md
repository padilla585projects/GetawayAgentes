# AGENTS.md — GetawayAgentes

AI agent network platform: gateway (Cloudflare Worker) + admin dashboard (Next.js). Agents collaborate on tasks, share knowledge, and communicate in real time.

## Commands

### Gateway (`cd gateway`)
```bash
npm run dev          # wrangler dev on :8787 (hot reload)
npm run type-check   # tsc --noEmit
npm run db:migrate   # apply D1 migrations locally
npm run db:migrate:prod  # apply D1 migrations to production
npm run deploy       # wrangler deploy
```

### Web (`cd web`)
```bash
npm run dev          # next dev on :3000
npm run build        # next build
npm run lint         # eslint (next core-web-vitals + typescript)
```

No test scripts exist in either package.

## Setup Gotchas

- **Gateway wrangler.toml**: KV `id` is a placeholder (`PENDIENTE-CREAR-CON-wrangler-kv-namespace-create`). Must run `wrangler kv namespace create KV` first.
- **Gateway secrets**: `SECRET_KEY` must be set via `wrangler secret put SECRET_KEY`.
- **First admin**: POST to `/auth/setup` (dev only) — see `gateway/src/index.ts:63`.
- **Web env**: create `web/.env.local` with `NEXT_PUBLIC_GATEWAY_URL` and `NEXT_PUBLIC_WS_URL`.

## Architecture

- **Gateway** (`gateway/src/index.ts`): Hono Worker. Routes: `/agents`, `/tasks`, `/knowledge`, `/auth/*`, `/mcp`. WebSocket at `/ws` delegates to `GatewayHub` DO.
- **GatewayHub** (`gateway/src/durable/GatewayHub.ts`): singleton DO. In-memory session map. Internal HTTP routes for route→hub communication (`/internal/notify-admin`, `/internal/broadcast-agents`, `/internal/send-agent`, `/internal/online-agents`, `/internal/orchestrate`). Handles agent-to-agent messaging, knowledge queries, collaborative orchestration.
- **MCP Server** (`gateway/src/mcp/server.ts`): Model Context Protocol endpoint at `/mcp`. Exposes tools: `list_agents`, `create_task`, `list_tasks`, `search_knowledge`, `add_knowledge`, `get_network_status`. Any MCP client (Claude Desktop, Cursor) can connect.
- **Web** (`web/`): Next.js App Router. `lib/api.ts` = typed fetch wrapper. `lib/ws.ts` = singleton `GatewaySocket`. Dashboard: Inicio, Agentes, Tareas, Conocimiento.

## Model Assignment Per Agent (Jul 2026)

| Agent | Model | Provider | Cost |
|-------|-------|----------|------|
| Finance | `gemini-2.0-flash` | Gemini (API key) | Free |
| Construction | `deepseek:deepseek-chat` | DeepSeek | ~$0.00006/req |
| Auto Electronics | `openrouter:google/gemma-4-26b-a4b-it:free` | OpenRouter free | Free (rate-limited) |
| Legal | `openai:gpt-4o-mini` | OpenAI | ~$0.00005/req |
| Project Coordinator | `anthropic:claude-3-haiku-20240307` | Anthropic | ~$0.00025/req |

All non-Gemini providers fall back to Gemini if they fail (rate-limit, timeout, etc).

## API Keys (encrypted backup)

Backup: `powershell -Command "$s = Get-Content .secrets.enc; $ss = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($(New-Object System.Security.SecureString)); $ptr = [System.Runtime.InteropServices.Marshal]::StringToBSTR(''); try { $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($([System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ss) | ConvertTo-SecureString)); [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ss) }"` (only works on same Windows machine that encrypted it)

## Collaboration Flow

1. Admin creates task with `mode: "collaborative"` (or agent uses MCP `create_task`)
2. Gateway finds online agents, creates subtasks based on capabilities
3. Each agent receives `subtask_assigned` with their specific part
4. Agents work in parallel, share progress via `agent_message`
5. Agents publish results to knowledge base, send `subtask_result`
6. Gateway aggregates results when all subtasks complete
7. Admin sees real-time progress in dashboard (subtask progress bar)

## WebSocket Message Types

From agents: `heartbeat`, `task_result`, `agent_message`, `knowledge_add`, `knowledge_query`, `knowledge_response`, `collaborate_accept`, `collaborate_reject`, `subtask_result`, `task_status_update`

From gateway: `heartbeat_ack`, `task_assigned`, `subtask_assigned`, `agent_online`, `agent_offline`, `agent_message`, `knowledge_proposal`, `knowledge_query`, `knowledge_response`, `agents_list`, `orchestration_complete`, `task_status_update`

## Critical Conventions

- **JSON columns in D1** (`capabilities`, `tags`, `assigned_agents`, `result`, `context`, `metadata`): stored as TEXT. Must `JSON.parse` on read, `JSON.stringify` on write.
- **IDs**: `nanoid()` from `gateway/src/services/utils.ts` (UUID without hyphens). Admins use `crypto.randomUUID()`.
- **Auth**: custom JWT (HS256) via Web Crypto API — no Node.js `crypto`.
- **Gateway**: ES2022 + `@cloudflare/workers-types`. No Node.js APIs.
- **Web**: `@/*` alias maps to `web/*`. Next.js 16 — read `node_modules/next/dist/docs/` before writing code.
- **Hub internal routes**: Routes call `hub.fetch('http://internal/...')` for non-WebSocket operations. The hub handles these in its `fetch()` method before the WebSocket upgrade check.

## DB Schema

Five tables in `gateway/migrations/0001_initial.sql`: `admins`, `agents`, `tasks`, `task_messages`, `knowledge_entries`. D1 is SQLite.

## Agent Lifecycle

1. Agent POSTs `/agents/register` → status `pending`
2. Admin approves via `/agents/:id/approve` → status `idle`, JWT issued
3. Agent connects `/ws?role=agent&token=<jwt>` → live in GatewayHub with capabilities
4. Admin creates task → dispatched via GatewayHub (broadcast/targeted/auto/collaborative)
5. For collaborative: gateway creates subtasks, agents work in parallel, results aggregated
6. Agent sends `task_result` or `subtask_result` over WS → admins notified in real time
