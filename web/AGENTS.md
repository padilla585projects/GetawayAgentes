<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Web App — GetawayAgentes Dashboard

Next.js 16 (React 19) admin panel. Connects to the gateway on :8787.

## Commands

```bash
npm run dev     # :3000
npm run build   # production build
npm run lint    # eslint (core-web-vitals + typescript)
```

## Key Files

- `lib/api.ts` — typed fetch wrapper (reads `admin_token` from localStorage)
- `lib/ws.ts` — singleton `GatewaySocket` (auto-reconnect 3s, type-based dispatch with `'*'` wildcard)
- `app/dashboard/layout.tsx` — sidebar + auth guard (redirects to `/` if no token)
- `app/page.tsx` — login page

## Conventions

- `@/*` path alias → `web/*` (set in `tsconfig.json`)
- All API calls go through `lib/api.ts` — never raw `fetch` outside that file
- WebSocket messages: listen via `gatewaySocket.on(type, handler)` — types match `gateway/src/models/types.ts`
- Tailwind v4 with `@tailwindcss/postcss` — no `tailwind.config` file (PostCSS-only config)
