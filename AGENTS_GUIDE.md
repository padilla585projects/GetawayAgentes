# Guía de Agentes - GetawayAgentes

Ejemplo y documentación completa de cómo crear agentes en diferentes lenguajes.

---

## 📚 Agentes Disponibles

### 1. **Node.js** (agent-example.js)
- ✅ Implementado y probado
- WebSocket nativo
- Perfecto para aprender
- **Usar cuando:** Quieres un ejemplo simple y funcional

**Ejecutar:**
```bash
npm install ws
node agent-example.js https://tu-gateway.workers.dev
```

---

### 2. **Python** (agent-python.py)
- ✅ Async/await
- Conexión WebSocket con `websockets`
- Ideal para datos e integraciones

**Requiere:**
```bash
pip install aiohttp websockets
```

**Ejecutar:**
```bash
python3 agent-python.py https://tu-gateway.workers.dev
```

**Ventajas:**
- Manejo async nativo
- Excelente para ML/data processing
- Fácil integración con numpy, pandas

---

### 3. **Go** (agent-go.go)
- ✅ Compilado, rápido
- Goroutines para concurrencia
- Cero dependencias externas en runtime

**Requiere:**
```bash
go get github.com/gorilla/websocket
```

**Compilar y ejecutar:**
```bash
go run agent-go.go https://tu-gateway.workers.dev
# O compilado:
go build -o agent-go agent-go.go
./agent-go https://tu-gateway.workers.dev
```

**Ventajas:**
- Rendimiento superior
- Concurrencia real (goroutines)
- Binario autocontenido
- Perfecto para producción

---

### 4. **Claude API** (agent-claude-api.js)
- ✅ Integración con Claude para IA
- Procesa tareas con razonamiento
- Demuestra cómo usar modelos de IA

**Requiere:**
```bash
npm install @anthropic-ai/sdk ws
export ANTHROPIC_API_KEY=tu-key-aqui
```

**Ejecutar:**
```bash
node agent-claude-api.js https://tu-gateway.workers.dev
```

**Ventajas:**
- Tareas procesadas por Claude API
- Análisis y razonamiento automático
- Inteligencia en cada respuesta
- Perfecto para agentes "smart"

---

## 🔄 Ciclo de Vida de un Agente

Todos los agentes siguen el mismo flujo:

```
1. REGISTRARSE
   POST /agents/register
   ↓
2. ESPERAR APROBACIÓN
   GET /agents/:id (polling cada 5s)
   ↓
3. RECIBIR TOKEN
   (asignado cuando es aprobado)
   ↓
4. CONECTAR WEBSOCKET
   WebSocket /ws?role=agent&token=...
   ↓
5. PROCESAR TAREAS
   Recibir messages, enviar resultados
   ↓
6. REPETIR HASTA CIERRE
```

---

## 🛠️ Crear Tu Propio Agente

### Pasos Básicos

1. **Registrarse**
```json
POST /agents/register
{
  "name": "Mi Agente",
  "capabilities": ["feature1", "feature2"],
  "tags": ["tag1", "tag2"]
}
→ { "id": "agent_123" }
```

2. **Esperar aprobación** (polling)
```json
GET /agents/agent_123
→ { "status": "idle", "token": "jwt_token" }
```

3. **Conectar WebSocket**
```
ws://gateway/ws?role=agent&token=jwt_token
```

4. **Procesar tareas**
```json
// Recibir:
{
  "type": "task_assigned",
  "task_id": "task_123",
  "title": "Mi Tarea",
  "description": "Descripción..."
}

// Enviar resultado:
{
  "type": "task_result",
  "task_id": "task_123",
  "agent_id": "agent_123",
  "status": "completed",
  "result": { "output": "..." }
}
```

---

## 📊 Comparación de Agentes

| Aspecto | Node.js | Python | Go | Claude |
|---------|---------|--------|-----|--------|
| **Aprendizaje** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Rendimiento** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Facilidad** | Muy fácil | Fácil | Moderada | Fácil |
| **Concurrencia** | Buena | Muy buena | Excelente | Buena |
| **Producción** | ✅ | ✅ | ⭐⭐⭐⭐⭐ | ✅ |
| **IA Integrada** | ❌ | ❌ | ❌ | ✅ |

---

## 🚀 Próximas Características para Agentes

- [ ] Agente Rust (máximo rendimiento)
- [ ] Agente C# (.NET)
- [ ] Persistencia de estado entre tareas
- [ ] Comunicación directa entre agentes
- [ ] Escalado automático (supervisión de recursos)
- [ ] Health checks y métricas

---

## 💡 Tips

1. **Desarrollo local**: Todos funcionan con `localhost:8787`
2. **Testing**: Aprueba agentes en el dashboard
3. **Depuración**: Revisa logs en CloudFlare Dashboard
4. **Métricas**: El gateway registra todos los tasks en D1
5. **Seguridad**: Tokens JWT expiran tras 1 hora

---

## 📞 Troubleshooting

### "Connection refused"
```bash
# Verifica que el gateway esté online
curl https://tu-gateway.workers.dev/
# Debe devolver: {"status":"ok",...}
```

### "Agent pending forever"
```bash
# Aprueba el agente en el dashboard
https://tu-web.pages.dev/dashboard/agents
# Busca "Esperando aprobación"
```

### "WebSocket error"
- Verificar token válido
- Verificar WS_URL (debe ser wss:// para HTTPS)
- Revisar logs de CloudFlare Workers

---

**Ahora tienes 4 agentes listos para usar. ¡Elige tu lenguaje favorito!** 🚀
