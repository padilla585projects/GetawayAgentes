# Cómo continuar con el proyecto

## Desde Windows

### Requisitos previos
- [Node.js 20+](https://nodejs.org)
- [Git](https://git-scm.com)
- [VS Code](https://code.visualstudio.com) con la extensión **Claude Code** instalada
- O bien usar directamente la CLI de Claude Code en la terminal

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/padilla585projects/GetawayAgentes.git
   cd GetawayAgentes
   ```

2. **Cambiar a la rama de trabajo**
   ```bash
   git checkout claude/add-claude-documentation-KdUQt
   ```

3. **Instalar dependencias**
   ```bash
   # Gateway
   cd gateway && npm install && cd ..

   # Web
   cd web && npm install && cd ..
   ```

4. **Configurar el entorno del gateway**

   Edita `gateway/wrangler.toml` y reemplaza los placeholders:
   ```bash
   # Instalar wrangler globalmente si no lo tienes
   npm install -g wrangler

   # Crear la base de datos D1
   wrangler d1 create getaway-db
   # Copia el database_id que te devuelve y pégalo en wrangler.toml

   # Crear el namespace KV
   wrangler kv namespace create KV
   # Copia el id que te devuelve y pégalo en wrangler.toml

   # Aplicar migraciones locales
   cd gateway && npm run db:migrate
   ```

5. **Configurar el entorno de la web**

   Crea el archivo `web/.env.local`:
   ```
   NEXT_PUBLIC_GATEWAY_URL=http://localhost:8787
   NEXT_PUBLIC_WS_URL=ws://localhost:8787/ws
   ```

6. **Arrancar en local**
   ```bash
   # Terminal 1 — gateway
   cd gateway && npm run dev

   # Terminal 2 — web
   cd web && npm run dev
   ```

7. **Abrir Claude Code en VS Code**

   Instala la extensión **Claude Code** desde el marketplace de VS Code, ábrela en la barra lateral y abre el proyecto. Claude leerá el `CLAUDE.md` automáticamente y tendrá contexto del proyecto.

   O desde la terminal integrada de VS Code:
   ```bash
   claude
   ```

---

## Desde Android con code-server

Puedes correr VS Code en el navegador de tu Android usando **code-server** alojado en un servidor remoto o en la propia nube.

### Opción A — GitHub Codespaces (recomendada, sin instalar nada)

1. Ve a `https://github.com/padilla585projects/GetawayAgentes`
2. Pulsa la tecla `.` — se abre VS Code en el navegador
3. O haz clic en **Code → Codespaces → Create codespace**
4. Desde la terminal del Codespace:
   ```bash
   git checkout claude/add-claude-documentation-KdUQt
   cd gateway && npm install
   cd ../web && npm install
   ```
5. Instala la extensión Claude Code desde el marketplace del Codespace
6. Ejecuta `claude` en la terminal integrada

### Opción B — Termux + code-server en Android

1. Instala [Termux](https://f-droid.org/en/packages/com.termux/) desde F-Droid
2. En Termux:
   ```bash
   pkg update && pkg install nodejs git
   npm install -g code-server
   code-server --auth none --port 8080
   ```
3. Abre el navegador en `http://localhost:8080`
4. Clona el repo y cambia de rama como en los pasos de Windows
5. Para Claude Code en Termux:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude
   ```

### Opción C — Claude Code Web (más sencilla)

Si ya tienes cuenta en claude.ai con acceso a Claude Code:

1. Ve a [claude.ai/code](https://claude.ai/code)
2. Conecta tu repositorio de GitHub
3. Selecciona la rama `claude/add-claude-documentation-KdUQt`
4. Claude cargará el `CLAUDE.md` y podrás continuar la conversación desde donde la dejaste

---

## Para no perder mejoras ni cambios

**La regla de oro: guarda en GitHub al terminar cada sesión.**

### Flujo habitual

```bash
# Ver qué has cambiado
git status

# Añadir los archivos modificados
git add .

# Guardar con un mensaje descriptivo
git commit -m "descripción de lo que hiciste"

# Subir a GitHub
git push
```

### Si trabajas desde varios dispositivos

Antes de empezar a editar en un nuevo dispositivo, descarga los últimos cambios:

```bash
git pull
```

Si no lo haces y editas en dos sitios a la vez, tendrás conflictos que resolver manualmente.

### Dejar que Claude haga el commit por ti

Claude Code puede commitear y hacer push directamente. Al final de una sesión de trabajo dile:

> "Guarda todos los cambios de hoy con un commit descriptivo y súbelos a GitHub."

### Qué NO se guarda en GitHub (y dónde sí)

| Archivo | Por qué no | Dónde guardarlo |
|---|---|---|
| `web/.env.local` | Contiene URLs privadas | En un bloc de notas o gestor de contraseñas |
| `gateway/wrangler.toml` (IDs reales) | IDs de tu cuenta Cloudflare | En Cloudflare Dashboard |
| `SECRET_KEY` | Es un secreto | En Wrangler con `wrangler secret put SECRET_KEY` |

Estos archivos están en `.gitignore` a propósito — nunca los subas.

### Historial de cambios

Para ver todo lo que se ha hecho en el proyecto:

```bash
git log --oneline
```

Si algo se rompe puedes volver a cualquier punto anterior:

```bash
git log --oneline          # ver el listado de commits con su código
git checkout <código>      # volver a ese punto (solo para revisar)
```

---

## Contexto del proyecto al retomar

Cuando abras Claude Code, puedes empezar con:

> "Estoy retomando el proyecto GetawayAgentes. Lee el CLAUDE.md y dime en qué estado está."

Esto le da a Claude el contexto completo para continuar sin repetir trabajo ya hecho.
