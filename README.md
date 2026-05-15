# GetawayAgentes

Red inteligente de agentes IA con gateway centralizado y dashboard admin en tiempo real.

**Estado:** 🟡 En desarrollo → 🟢 Listo para deploy

---

## 🚀 Inicio Rápido

### Desde PC (desarrollo local)

```bash
# Terminal 1: Gateway
cd gateway && npm run dev        # http://localhost:8787

# Terminal 2: Web
cd web && npm run dev            # http://localhost:3000

# Terminal 3: Agente de ejemplo
npm install ws
node agent-example.js            # Se registra automáticamente
```

Luego:
1. Login en http://localhost:3000
2. Aprueba el agente en **Agentes**
3. Crea una tarea en **Tareas**
4. Ves el resultado en tiempo real

### Deploy a Cloudflare (cuando esté listo)

```bash
wrangler login
bash deploy.sh
# Luego sigue instrucciones para Pages
```

---

## 📖 Documentación

### Para Entender el Proyecto
- **[CLAUDE.md](./CLAUDE.md)** — Arquitectura, comandos, convenciones (para IA)
- **[PROGRESS.md](./PROGRESS.md)** — Estado actual, qué falta, próximos pasos

### Para Trabajar Según tu Plataforma
- **[PLATFORM_RULES.md](./PLATFORM_RULES.md)** — Qué hacer en móvil vs PC (¡LEER ESTO!)
- **[NOTES.md](./NOTES.md)** — Notas entre plataformas (comparte ideas)

### Para Operaciones Específicas
- **[CONTINUAR.md](./CONTINUAR.md)** — Windows, Android, Codespaces
- **[DEPLOY.md](./DEPLOY.md)** — Desplegar a Cloudflare
- **[AGENT_EXAMPLE.md](./AGENT_EXAMPLE.md)** — Usar el agente de ejemplo

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                    Administrador (Web)              │
│            Next.js 16 + React 19 + Tailwind         │
│                   localhost:3000                     │
└────────────────────────┬────────────────────────────┘
                         │ HTTP + WebSocket
                         │
┌────────────────────────▼────────────────────────────┐
│                GetawayAgentes Gateway               │
│          Cloudflare Workers + Hono + D1 + KV        │
│                   localhost:8787                     │
│                                                      │
│  ✅ Autenticación JWT (admin + agentes)            │
│  ✅ WebSocket tiempo real (GatewayHub DO)          │
│  ✅ Base de datos SQLite (D1)                      │
│  ✅ Cache KV para tokens                           │
└────────────────────────┬────────────────────────────┘
                         │ WebSocket
          ┌──────────────┼──────────────┐
          │              │              │
     ┌────▼──┐      ┌────▼──┐     ┌────▼──┐
     │Agente1│      │Agente2│     │AgentN │
     │(Node) │      │(Py)   │     │(Go)   │
     └───────┘      └───────┘     └───────┘
```

**Flujo:**
1. Admin crea tarea → Gateway la distribuye
2. Agentes reciben vía WebSocket
3. Agentes procesan y envían resultado
4. Admin ve actualización en tiempo real
5. Resultado guardado en D1

---

## 📊 Estado del Proyecto

| Componente | Estado | Notas |
|-----------|--------|-------|
| **Gateway** | ✅ | Cloudflare Workers, D1, KV, autenticado |
| **Web** | ✅ | Next.js, tiempo real, dashboards |
| **Agente Ejemplo** | ✅ | Node.js, demostrativo |
| **Autenticación** | ✅ | JWT en todas las rutas admin |
| **WebSocket Tiempo Real** | ✅ | Tareas y agentes actualizan automáticamente |
| **Deploy Automation** | ✅ | Script `deploy.sh` lista todo |
| **Dashboard Avanzado** | ⏳ | Próximo: gráficas, estadísticas |
| **Agentes Python/Go** | ⏳ | Próximo: ejemplos en otros lenguajes |
| **Tests** | ⏳ | Próximo: tests E2E |
| **Seguridad** | ⏳ | Próximo: rate limiting, validación |

Ver [PROGRESS.md](./PROGRESS.md) para lista completa.

---

## 🎯 Próximos Pasos

Según [PROGRESS.md](./PROGRESS.md), después del deploy:

- **B)** Mejorar dashboard (gráficas, estadísticas)
- **C)** Agentes en Python/Go
- **D)** Seguridad (rate limiting, validación)
- **E)** Features avanzadas (colaboración, persistencia)
- **F)** Testing (unitarios, E2E)
- **G)** Documentación técnica (OpenAPI)

---

## 🔄 Trabajar entre Plataformas

**¡IMPORTANTE!** Lee [PLATFORM_RULES.md](./PLATFORM_RULES.md) para:
- Qué hacer en móvil vs PC
- Cómo no perder continuidad
- Checklist antes de cambiar de plataforma
- Flujos completos

**Usa [NOTES.md](./NOTES.md)** para comunicarte entre dispositivos.

---

## 🛠️ Tecnologías

**Gateway:**
- Cloudflare Workers (serverless)
- Hono (framework HTTP)
- D1 (SQLite en Cloudflare)
- KV (cache distribuido)
- Durable Objects (WebSocket persistente)
- TypeScript

**Web:**
- Next.js 16 (React 19)
- TailwindCSS v4
- TanStack Query + Zustand
- TypeScript

**Agentes:**
- Node.js (ejemplo)
- WebSocket (cliente)
- HTTP (registro)

---

## 📦 Estructura del Repo

```
GetawayAgentes/
├── README.md                    # Este archivo
├── CLAUDE.md                    # Guía para IA
├── PROGRESS.md                  # Estado + próximos pasos
├── PLATFORM_RULES.md            # Reglas móvil vs PC ⭐
├── NOTES.md                     # Notas compartidas ⭐
├── CONTINUAR.md                 # Cómo seguir desde diferentes plataformas
├── DEPLOY.md                    # Guía de deploy
├── deploy.sh                    # Script automático
├── agent-example.js             # Agente Node.js de demostración
│
├── gateway/
│   ├── src/
│   │   ├── index.ts             # App principal
│   │   ├── middleware/auth.ts   # Autenticación JWT
│   │   ├── durable/             # Durable Objects
│   │   ├── routes/              # API endpoints
│   │   ├── services/            # Lógica compartida
│   │   └── models/              # Tipos
│   ├── migrations/              # D1 migrations
│   └── wrangler.toml            # Configuración Workers
│
└── web/
    ├── app/
    │   ├── page.tsx             # Login
    │   ├── dashboard/           # Admin panels
    │   └── layout.tsx           # Layout principal
    ├── lib/
    │   ├── api.ts               # Cliente HTTP
    │   └── ws.ts                # Cliente WebSocket
    └── next.config.ts           # Configuración Next.js
```

---

## 💡 Características Principales

✅ **Gateway centralizado** — Un punto de entrada para todos los agentes
✅ **Autenticación JWT** — Agentes y admins autenticados
✅ **WebSocket tiempo real** — Actualizaciones instantáneas
✅ **Base de datos SQLite** — Persistencia en Cloudflare D1
✅ **Dashboard intuitivo** — Admin panel para controlar agentes
✅ **Escalable** — Diseño para múltiples agentes simultáneamente
✅ **Sin dependencias pesadas** — Corre en Cloudflare Workers
✅ **Documentación completa** — Guías para cada plataforma

---

## 🚀 Deploy a Producción

```bash
# En tu PC
wrangler login
bash deploy.sh

# Luego en Cloudflare Dashboard
# Pages → Create project → GetawayAgentes → Deploy
```

Ver [DEPLOY.md](./DEPLOY.md) para instrucciones detalladas.

---

## 🐛 Troubleshooting

**"Cannot find module 'ws'"**
```bash
npm install ws
```

**"wrangler not found"**
```bash
npm install -g wrangler
```

**"Gateway no responde"**
```bash
# Verifica que está corriendo
curl http://localhost:8787/
# Debe devolver: {"status":"ok",...}
```

**"Agent no se aprueba"**
```
1. Verifica que estés logueado en http://localhost:3000
2. Abre http://localhost:3000/dashboard/agents
3. Busca "Agente Ejemplo" en "Esperando aprobación"
4. Haz clic en Aprobar
```

Ver [PLATFORM_RULES.md](./PLATFORM_RULES.md) para más troubleshooting.

---

## 📞 Soporte

- Documentación técnica: [CLAUDE.md](./CLAUDE.md)
- Comandos disponibles: [CLAUDE.md](./CLAUDE.md) (sección "Commands")
- Decisiones de diseño: [CLAUDE.md](./CLAUDE.md) (sección "Key Conventions")
- Problemas de desarrollo: [PLATFORM_RULES.md](./PLATFORM_RULES.md)

---

## 📄 Licencia

Proyecto educativo. Ver [LICENSE](./LICENSE).

---

## 👤 Comenzar

**Si estás en MÓVIL:**
1. Lee [PLATFORM_RULES.md](./PLATFORM_RULES.md)
2. Abre un issue si tienes ideas
3. Espera a estar en PC para implementar

**Si estás en PC:**
1. Lee [CLAUDE.md](./CLAUDE.md) para entender la arquitectura
2. Lee [PROGRESS.md](./PROGRESS.md) para ver qué está hecho
3. Ejecuta `bash deploy.sh` si es la primera vez
4. O continúa con el siguiente paso de [PROGRESS.md](./PROGRESS.md)

**Próxima sesión:**
- Abre Claude Code en este repo
- Lee [PROGRESS.md](./PROGRESS.md)
- Dile a Claude: "Continúa con el siguiente punto"

---

**¡Listo para crear la red de agentes más inteligente! 🚀**
