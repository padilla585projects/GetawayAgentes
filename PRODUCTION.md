# 🚀 Credenciales de Producción - GetawayAgentes

**⚠️ CONFIDENCIAL - No compartir públicamente**

## URLs de Producción

- **Gateway API:** https://getaway-gateway.alejandra-app.workers.dev
- **Web Dashboard:** https://getaway-web.alejandra-app.pages.dev

## Admin de Producción

```
Username: admin2
Password: Mi1234!
```

## Token JWT (válido por 1 hora)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MWIyMDRjYy0wZTczLTQyOGMtYjFlZC0wZjUzYWJkM2E0MTgiLCJuYW1lIjoiYWRtaW4yIiwidHlwZSI6ImFkbWluIn0=.6GxkrqECszf2wSsd+2IbDJOHUU5dKYTjH8lAEaSu1YU=
```

## Obtener nuevo token

```bash
curl -X POST https://getaway-gateway.alejandra-app.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin2","password":"Mi1234!"}'
```

## Dashboard

1. Abre: https://getaway-web.alejandra-app.pages.dev
2. Login con admin2 / Mi1234!
3. Aprobar agentes y crear tareas

## Información de la Base de Datos

- **Database ID:** 020a7269-72fd-4b0a-a00e-f3160edbf059
- **Database Name:** getaway-db
- **Provider:** Cloudflare D1

### Ver admins registrados

```bash
wrangler d1 execute getaway-db --remote --command "SELECT id, username, email FROM admins;"
```

## Próximos pasos

1. ✅ Gateway funciona
2. ✅ Base de datos sincronizada
3. ⏳ Dashboard web (verificar acceso)
4. ⏳ Conectar agentes
5. ⏳ Crear tareas de prueba

---

**Actualizado:** 2026-05-15
**Responsable:** Equipo de Desarrollo
