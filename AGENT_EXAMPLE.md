# Agente de Ejemplo

Este directorio incluye un agente de ejemplo funcional que demuestra cómo conectarse a la red GetawayAgentes, recibir tareas y devolver resultados.

## Instalación

```bash
# Copiar el package.json a la raíz si no está ya allí
cp agent-example-package.json package.json

# Instalar dependencias
npm install
```

## Uso

### 1. Asegúrate de que el gateway está corriendo

```bash
cd gateway
npm run dev
```

El gateway estará en `http://localhost:8787`.

### 2. Arranca el agente de ejemplo

En otra terminal:

```bash
node agent-example.js
```

Verás algo como:
```
[Agente Ejemplo] Registrando en el gateway...
[Agente Ejemplo] Registrado con ID: abc123def456
[Agente Ejemplo] Esperando aprobación del admin...
[Agente Ejemplo] Puedes aprobar el agente en http://localhost:3000/dashboard/agents
```

### 3. Aprueba el agente desde el dashboard

1. Abre http://localhost:3000 (la web app)
2. Login con usuario/contraseña que creaste en `/auth/setup`
3. Ve a **Agentes**
4. Verás "Agente Ejemplo" en la sección "Esperando aprobación"
5. Haz clic en **Aprobar** (puedes dejar la confianza como "viewer")

El agente se conectará automáticamente y quedará listo.

### 4. Envía una tarea

Desde el dashboard:

1. Ve a **Tareas**
2. Haz clic en **+ Nueva tarea**
3. Rellena:
   - Título: "Procesar documento"
   - Descripción: "Analiza este documento"
   - Modo: "broadcast" (así llega a todos)
   - Prioridad: 5
4. Haz clic en **Enviar tarea**

El agente recibirá la tarea, la procesará (espera 2 segundos), y devolverá un resultado.

Verás en la terminal del agente:
```
[Agente Ejemplo] Tarea asignada: Procesar documento (ID: task123)
[Agente Ejemplo] Resultado enviado para tarea task123
```

Y en el dashboard verás el resultado en tiempo real.

## Opciones de ejecución

```bash
# Especificar URL del gateway
GATEWAY_URL=http://localhost:8787 node agent-example.js

# Especificar nombre del agente
AGENT_NAME="Mi Agente" node agent-example.js

# Ambas opciones
GATEWAY_URL=http://example.com:8787 AGENT_NAME="Bot Análisis" node agent-example.js
```

O desde la línea de comandos:
```bash
node agent-example.js http://localhost:8787
```

## Cómo funciona

1. **Registro**: El agente hace `POST /agents/register` con sus capacidades
2. **Espera aprobación**: Revisa cada 5 segundos si el admin lo aprobó
3. **Conexión WebSocket**: Cuando recibe el token, se conecta a `/ws`
4. **Recibe tareas**: El gateway envía `task_assigned` cuando hay una tarea
5. **Procesa**: Simula procesamiento (2 segundos)
6. **Responde**: Envía `task_result` con el resultado

## Estructura del agente

```javascript
class Agent {
  register()          // POST /agents/register
  waitForApproval()   // Polling hasta recibir token
  connect()           // WebSocket /ws
  handleMessage()     // Procesa mensajes del gateway
  processTask()       // Lógica de negocio
  send()              // Envía mensajes al gateway
}
```

## Próximos pasos

Para crear tu propio agente:

1. Copia `agent-example.js` como base
2. Modifica `processTask()` con tu lógica
3. Cambia `capabilities` con lo que tu agente puede hacer
4. Modifica `AGENT_NAME` y descripción

## Troubleshooting

**"Error al registrar: error desconocido"**
- Verifica que el gateway está corriendo en `http://localhost:8787`
- Revisa que el token de admin es válido

**"Esperando aprobación..." (se queda atascado)**
- Abre el dashboard y aprueba el agente
- Si no aparece en la lista, revisa los logs del gateway

**"Desconectado del gateway"**
- El agente intenta reconectarse cada 3 segundos
- Verifica que el WebSocket del gateway está funcionando

**"Error al procesar mensaje"**
- Revisa los logs del agente
- Puede ser un JSON malformado del gateway

## Licencia

Ejemplo de código bajo la licencia del proyecto GetawayAgentes.
