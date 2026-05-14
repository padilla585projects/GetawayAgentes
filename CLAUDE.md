# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

GetawayAgentes is an AI agent network platform. The **gateway** is the central hub that AI agents connect to, receive tasks from, and report results to. The **web** app is a human admin panel for approving agents, dispatching tasks, and monitoring activity in real time.

There are no tests configured in either package.

## Repository Structure

```
gateway/   — Cloudflare Worker (Hono + D1 + KV + Durable Objects)
web/       — Next.js 16 admin dashboard (React 19 + Tailwind v4)
```

## Commands

### Gateway (`cd gateway`)
```bash
npm run dev          # wrangler dev — local Worker with hot reload
npm run type-check   # tsc --noEmit
npm run db:migrate   # apply D1 migrations locally
npm run db:migrate:prod  # apply D1 migrations to production
npm run deploy       # wrangler deploy to production
```

Before running locally, the `wrangler.toml` placeholders must be replaced:
- `database_id`: run `wrangler d1 create getaway-db` to get an ID
- KV `id`: run `wrangler kv namespace create KV` to get an ID
- `SECRET_KEY` secret: run `wrangler secret put SECRET_KEY`

Bootstrap the first admin (development only):
```bash
curl -X POST http://localhost:8787/auth/setup \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","email":"a@a.com","password":"secret"}'
```

### Web (`cd web`)
```bash
npm run dev    # next dev on :3000
npm run build  # next build
npm run lint   # eslint
```

The web app needs these env vars (create `web/.env.local`):
```
NEXT_PUBLIC_GATEWAY_URL=http://localhost:8787
NEXT_PUBLIC_WS_URL=ws://localhost:8787/ws
```

## Architecture

### Gateway

The gateway is a single Cloudflare Worker (`gateway/src/index.ts`) that wires together:

- **Hono routes**: `/agents`, `/tasks`, `/knowledge`, `/auth/login`, `/auth/setup`
- **WebSocket endpoint** `/ws`: validates a JWT, then delegates the connection to the `GatewayHub` Durable Object
- **GatewayHub** (`gateway/src/durable/GatewayHub.ts`): a singleton Durable Object (keyed `'main'`) that holds all active WebSocket sessions in memory. It is the message bus — it routes `task_result` and `knowledge_add` from agents to admins, and `agent_message` between agents. Routes call into it via internal `hub.fetch()` HTTP calls to broadcast tasks.

**Auth** (`gateway/src/services/auth.ts`): a custom JWT (HS256) built on the Web Crypto API — no Node.js crypto, necessary for the Workers runtime.

**Database schema** (`gateway/migrations/0001_initial.sql`): five tables — `admins`, `agents`, `tasks`, `task_messages`, `knowledge_entries`. JSON arrays/objects are stored as TEXT and parsed in route handlers. D1 is SQLite.

**KV** is used as a fast lookup cache for approved agent tokens (`agent_token:<id>`).

### Agent Lifecycle

1. Agent POSTs to `/agents/register` → status `pending`
2. Admin approves via `/agents/:id/approve` → status `idle`, agent receives a JWT
3. Agent connects to `/ws?role=agent&token=<jwt>` → live in `GatewayHub`
4. Admin creates a task → dispatched via GatewayHub (broadcast or targeted)
5. Agent sends `task_result` over WebSocket → admins notified in real time

Trust levels: `viewer` < `contributor` < `trusted` (set on approval or via `PATCH /agents/:id/trust`).

Task modes: `broadcast` (all connected agents), `targeted` (specific agent IDs), `auto` (targeted if `assigned_agents` is non-empty, else broadcast).

### Web App

Next.js App Router with two areas:
- `/` — login page, stores `admin_token` in `localStorage`
- `/dashboard/*` — protected; layout checks token on mount and redirects to `/` if missing

State: `lib/api.ts` is a thin typed fetch wrapper (reads token from `localStorage`, points at `NEXT_PUBLIC_GATEWAY_URL`). `lib/ws.ts` exports a singleton `GatewaySocket` that connects as `role=admin`, auto-reconnects after 3s, and dispatches messages by type or via the `'*'` wildcard.

The dashboard currently has pages for Inicio, Agentes, Tareas, and Conocimiento (sidebar in `web/app/dashboard/layout.tsx`).

## Key Conventions

- **Gateway**: all JSON columns (`capabilities`, `tags`, `assigned_agents`, `result`, `context`, `metadata`) are stored as TEXT and must be `JSON.parse`d on read and `JSON.stringify`d on write — no automatic serialization.
- **Gateway**: IDs are generated with `nanoid()` from `gateway/src/services/utils.ts` (UUID without hyphens), except admins which use `crypto.randomUUID()` directly in `index.ts`.
- **Web**: the `@/*` path alias maps to `web/*` (set in `web/tsconfig.json`).
- **Web**: `web/AGENTS.md` / `web/CLAUDE.md` instruct agents to read `node_modules/next/dist/docs/` before writing Next.js code — this is Next.js 16 with breaking changes from earlier versions.
- Both packages use strict TypeScript. The gateway targets ES2022 with `@cloudflare/workers-types`; do not use Node.js APIs.
