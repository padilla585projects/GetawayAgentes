# Deploy a Cloudflare

Guía rápida para desplegar GetawayAgentes en Cloudflare (Gateway + Web).

## Requisitos

- Cuenta en [Cloudflare](https://cloudflare.com)
- [Node.js 20+](https://nodejs.org)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) instalado globalmente:
  ```bash
  npm install -g wrangler
  ```

## Pasos

### 1. Autenticar con Cloudflare

```bash
wrangler login
```

Esto abre tu navegador para que inicies sesión con Cloudflare. Una vez completado, cierra el navegador.

### 2. Ejecutar el script de deploy

```bash
bash deploy.sh
```

Este script:
- ✅ Crea la base de datos D1
- ✅ Crea el namespace KV
- ✅ Configura el SECRET_KEY
- ✅ Aplica migraciones
- ✅ Despliega el Gateway en Workers
- ✅ Prepara la web para Cloudflare Pages

### 3. Desplegar la web en Cloudflare Pages

El script te dará instrucciones, pero en resumen:

**Opción A - Dashboard (más simple):**
1. Ve a https://dash.cloudflare.com → Pages
2. "Create a project" → Connect to Git → GetawayAgentes
3. Build settings:
   - Framework: **Next.js**
   - Build command: `npm run build`
   - Build output directory: `.next`
4. Environment Variables (agregar ambas):
   ```
   NEXT_PUBLIC_GATEWAY_URL=<URL-del-gateway-que-te-dio-el-script>
   NEXT_PUBLIC_WS_URL=<same-pero-con-wss://-en-lugar-de-https://>
   ```
5. Deploy

**Opción B - CLI:**
```bash
npm install -D @cloudflare/next-on-pages
npm run build
npx wrangler pages deploy out
```

## Después del Deploy

### Crear el primer admin

Reemplaza `<GATEWAY_URL>` con la URL que te dio el script:

```bash
curl -X POST https://<GATEWAY_URL>/auth/setup \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "tu-contraseña-fuerte"
  }'
```

### Probar con el agente de ejemplo

```bash
node agent-example.js https://<GATEWAY_URL>
```

Luego aprueba el agente en tu dashboard y crea una tarea para probarlo.

## URLs Finales

- **Gateway**: `https://getaway-gateway.<account>.workers.dev`
- **Web**: `https://getaway-web.<account>.pages.dev` (o tu dominio propio)
- **Login**: `https://getaway-web.<account>.pages.dev` (usuario/contraseña del primer admin)

## Troubleshooting

**"Error: D1 database already exists"**
- Es normal. El script te pedirá el ID manualmente.
- Puedes encontrarlo en Cloudflare Dashboard → D1 → getaway-db

**"Error: KV namespace already exists"**
- Mismo que arriba. Busca en Cloudflare Dashboard → Workers → KV

**"SECRET_KEY already exists"**
- Ejecuta: `wrangler secret delete SECRET_KEY` y luego el script de nuevo

**"Pages deployment failed"**
- Verifica que las env vars estén correctas (NEXT_PUBLIC_GATEWAY_URL)
- Revisa los logs en Cloudflare Dashboard → Pages → Deployments

## Variables de Entorno (para referencia)

| Variable | Donde | Valor |
|----------|-------|-------|
| `DATABASE_ID` | wrangler.toml (D1) | ID de tu base de datos |
| `KV_ID` | wrangler.toml (KV) | ID de tu namespace |
| `SECRET_KEY` | wrangler secret | Contraseña fuerte (HS256) |
| `NEXT_PUBLIC_GATEWAY_URL` | web/.env.local | https://getaway-gateway.* |
| `NEXT_PUBLIC_WS_URL` | web/.env.local | wss://getaway-gateway.* |

## Rollback

Si algo sale mal:

```bash
# Eliminar el Gateway
wrangler delete

# Eliminar base de datos
wrangler d1 delete getaway-db

# Eliminar KV
wrangler kv namespace delete KV

# Eliminar Pages (desde el dashboard)
```

Luego vuelve a ejecutar `bash deploy.sh`.

---

¿Problemas? Revisa el [CLAUDE.md](./CLAUDE.md) para más contexto sobre la arquitectura.
