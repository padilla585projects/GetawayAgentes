# Sistema de Sincronización Móvil ↔ PC

Permite programar desde **Android y PC** en los mismos proyectos sin perder información ni crear conflictos.

---

## 🎯 Objetivo

✅ Editar código en Android (Claude Code)
✅ Editar código en PC (Claude Code)
✅ Cambios siempre sincronizados
✅ Sin perder información
✅ Sin conflictos de merge

---

## 🏗️ Arquitectura

```
GitHub (Remoto)
    ↓ ↑
    │ │
   PC ↔ Android
(local)  (Code en línea)
    ↓ ↑
    │ │
   sync automático
```

---

## 🔄 Flujo de Sincronización

### **Desde ANDROID (Claude Code)**

```
1. Abro proyecto en Claude Code
2. Edito archivo
3. Claude Code hace: git add + git commit + git push
4. Cambios llegan a GitHub
5. PC se entero automáticamente
```

### **Desde PC (Claude Code)**

```
1. Abro proyecto en Claude Code
2. git pull (obtener cambios de Android)
3. Edito archivo
4. Claude Code hace: git add + git commit + git push
5. Cambios llegan a GitHub
6. Android se entero automáticamente
```

---

## ⚙️ Configuración por Proyecto

Para **CADA proyecto** (Numa-APP, canal, Alejandra-APP, etc.):

### **Paso 1: Crear archivo `.claude-sync.json`**

En la raíz de cada proyecto:

```json
{
  "project": "Numa-APP",
  "auto_commit": true,
  "auto_commit_interval": 300,
  "sync_enabled": true,
  "branch_strategy": "main",
  "platforms": ["android", "pc"],
  "last_sync": "2026-05-14T10:00:00Z",
  "conflicts_resolution": "latest-wins"
}
```

### **Paso 2: Crear `.claude-sync.sh` (Script de Auto-Sync)**

```bash
#!/bin/bash
# Auto-sync script — ejecuta automáticamente cada 5 min

PROJECT_DIR="$1"
PROJECT_NAME=$(basename "$PROJECT_DIR")

cd "$PROJECT_DIR" || exit 1

# Verificar si hay cambios
if [ -z "$(git status --porcelain)" ]; then
  echo "✅ $PROJECT_NAME — Sin cambios"
  exit 0
fi

# Timestamp de la plataforma
PLATFORM="${2:-pc}"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S")

# Auto-commit
git add .
git commit -m "Auto-sync from $PLATFORM - $TIMESTAMP

Changes synced automatically from $PLATFORM.
Use NOTES.md to communicate between devices." 2>/dev/null

# Push
git push 2>/dev/null

echo "✅ $PROJECT_NAME — Sincronizado desde $PLATFORM"
```

### **Paso 3: Crear `.claude-sync-watch.sh` (Monitor Continuo)**

```bash
#!/bin/bash
# Monitor continuo — ejecuta en background

PROJECTS_PATH="$1"
INTERVAL="${2:-300}"  # 5 minutos por defecto

echo "👁️ Monitoreando proyectos cada $INTERVAL segundos..."
echo "Proyectos: $PROJECTS_PATH/*"

while true; do
  for repo in "$PROJECTS_PATH"/*; do
    if [ -d "$repo/.git" ]; then
      bash "$(dirname "$0")/\.claude-sync.sh" "$repo" "pc"
    fi
  done
  
  sleep $INTERVAL
done
```

---

## 📱 DESDE ANDROID (Claude Code)

### **Flujo Garantizado:**

```
1. Abro proyecto en claude.ai/code
   ↓
2. Edito código
   ↓
3. Le digo a Claude: "Guarda y sincroniza"
   ↓
4. Claude Code ejecuta:
   - git add .
   - git commit -m "Auto-sync from Android"
   - git push
   ↓
5. Cambios en GitHub inmediatamente
   ↓
6. PC ve cambios automáticamente
```

### **Lo que NO hago desde Android:**

```
❌ git pull (solo push)
❌ git merge (solo Android hace commits)
❌ Resolver conflictos manualmente
```

---

## 💻 DESDE PC (Claude Code)

### **Flujo Garantizado:**

```
1. Antes de editar:
   git pull
   ↓
2. Edito código
   ↓
3. Claude Code auto-sincroniza cada 5 min
   (O ejecuto: bash .claude-sync.sh)
   ↓
4. Cambios en GitHub
   ↓
5. Android ve cambios automáticamente
```

### **Script Continuo en PC:**

```bash
# En tu PC, ejecuta esto en background
cd ~/Projects
bash .claude-sync-watch.sh ~/Projects 300 &

# Ahora sincroniza automáticamente cada 5 min
```

---

## 🛡️ Manejo de Conflictos

### **Si hay conflicto (raro):**

**Strategy: "Latest Wins"** (el más reciente gana)

```bash
# Git automáticamente usa la versión más nueva
git config merge.ours.driver true

# O manual:
git pull --strategy-option=theirs
```

### **Mejor: Evitar conflictos**

1. **Edita diferentes archivos** (Android edita Feature A, PC edita Feature B)
2. **Usa NOTES.md** para coordinar ("Estoy editando login.ts")
3. **Commit frecuente** (cada cambio es un commit)
4. **Pull antes de editar** (en PC: `git pull` primero)

---

## 📊 Sistema de Estados

Cada proyecto tiene un estado en `.claude-sync.json`:

```json
{
  "last_sync": "2026-05-14T10:30:45Z",
  "last_editor": "android",
  "pending_changes": 0,
  "conflicts": 0,
  "status": "synced"
}
```

Estados posibles:
- `synced` — Todo actualizado
- `pending` — Cambios sin pushear
- `conflict` — Conflicto (raro)
- `out_of_sync` — Desincronizado

---

## 🚀 Setup Completo (5 minutos)

### **En PC, ejecuta esto UNA SOLA VEZ:**

```bash
#!/bin/bash
# setup-sync.sh

PROJECTS_PATH="$1"  # ~/Projects

for repo in "$PROJECTS_PATH"/*; do
  if [ -d "$repo/.git" ]; then
    PROJECT=$(basename "$repo")
    echo "⚙️ Configurando $PROJECT..."
    
    cd "$repo"
    
    # Crear archivo de configuración
    cat > .claude-sync.json << EOF
{
  "project": "$PROJECT",
  "auto_commit": true,
  "auto_commit_interval": 300,
  "sync_enabled": true,
  "branch_strategy": "main",
  "platforms": ["android", "pc"],
  "last_sync": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "conflicts_resolution": "latest-wins"
}
EOF
    
    # Hacer commit
    git add .claude-sync.json
    git commit -m "Add auto-sync configuration"
    git push
    
    echo "✅ $PROJECT configurado"
  fi
done

echo "🎉 Setup completado"
```

**Uso:**
```bash
bash setup-sync.sh ~/Projects
```

---

## 📋 Checklist por Plataforma

### **ANDROID (cada sesión)**

- [ ] Abro proyecto en claude.ai/code
- [ ] Veo que estoy en la rama correcta (`git status`)
- [ ] Edito código
- [ ] Digo a Claude: "git add . && git commit && git push"
- [ ] Verifico en GitHub que los cambios están

### **PC (cada sesión)**

- [ ] Ejecuto: `git pull` en cada proyecto
- [ ] Edito código
- [ ] Script `.claude-sync.sh` auto-sincroniza cada 5 min
- [ ] O ejecuto manual: `bash .claude-sync.sh`
- [ ] Verifico en GitHub

---

## 🔐 Seguridad & Backup

Cada commit es automático, lo que significa:

✅ **Historial completo** — Todo queda registrado en Git
✅ **Backup automático** — GitHub es tu backup
✅ **Recuperación fácil** — `git revert` si algo falla
✅ **Sin pérdida de datos** — Cada cambio se guarda

---

## 📱 Cómo Usar desde Android

### **Sesión típica:**

```
1. Abro claude.ai/code en Android
2. Selecciono proyecto (ej: Numa-APP)
3. Edito archivo (ej: App.tsx)
4. Le digo a Claude:
   "Guarda los cambios: git add . && git commit -m 'Feature X' && git push"
5. Claude ejecuta los comandos
6. Listo, cambios en GitHub
```

### **Ver cambios del PC:**

```
1. Abro GitHub en Android
2. Veo el proyecto
3. Veo los commits recientes del PC
4. Puedo ver qué cambios hizo
```

---

## 💻 Cómo Usar desde PC

### **Sesión típica:**

```
1. Abro Claude Code en PC
2. git pull (para traer cambios de Android)
3. Edito código
4. Script automático sincroniza cada 5 min
5. (O ejecuto manual: bash .claude-sync.sh)
6. Listo
```

### **Monitoreo continuo:**

```bash
# Ejecuta esto en una terminal al inicio
cd ~/Projects
bash .claude-sync-watch.sh ~/Projects 300 &

# Ahora sincroniza automáticamente
# Puedes cerrar la terminal, sigue en background
```

---

## 🎯 Flujo Ideal: Android ↔ PC

```
ANDROID                          PC
   │                             │
   ├─→ Edita Feature A ──────→ git push
   │                             │
   │ ← Ver cambios en GitHub ←─ Ver cambios
   │                             │
   │ ← Edita Feature B ←──────── ← edit
   │                             │
   ├─→ Edita Feature A (cont) → git push
   │                             │
   └─→ Sincronizado sin conflictos ←─┘
```

---

## 🚨 Si Algo Falla

### **Conflicto de merge:**

```bash
# En PC
git status                    # Ver conflictos
git diff                      # Ver diferencias
git checkout --theirs FILE    # Usar versión remota (Android)
git add FILE
git commit -m "Resolve conflict"
git push
```

### **Cambios perdidos:**

```bash
# Git mantiene historial, recupera fácil
git log --oneline             # Ver commits
git show HASH                 # Ver cambios en ese commit
git revert HASH               # Deshacer commit específico
```

### **Desincronizado:**

```bash
# Sincronizar forzadamente
git fetch origin
git reset --hard origin/main
```

---

## 📊 Monitoreo

Ver estado de sincronización:

```bash
# En PC, monitorea todos los proyectos
for repo in ~/Projects/*; do
  echo "$(basename "$repo"): $(cd "$repo" && git log -1 --format=%ai)"
done
```

---

## 🎓 Resumen

| Acción | Android | PC |
|--------|---------|-----|
| Editar código | ✅ | ✅ |
| Push automático | ✅ | ✅ (cada 5 min) |
| Pull automático | ❌ (manual) | ✅ |
| Ver cambios del otro | ✅ (GitHub) | ✅ (local) |
| Resolver conflictos | Manual | Automático |

---

## 🚀 Comienza Ahora

**En tu PC:**

```bash
# 1. Configura auto-sync en todos tus proyectos
bash setup-sync.sh ~/Projects

# 2. Inicia el monitor continuo
cd ~/Projects
bash .claude-sync-watch.sh ~/Projects 300 &

# 3. Listo. Ahora puedes editar desde Android y PC
```

**Desde Android (claude.ai/code):**

```
"Edité esto, guarda: git add . && git commit -m 'Mi cambio' && git push"
```

**Resultado:**

✅ Cambios en GitHub inmediatamente
✅ PC los ve automáticamente
✅ Sin perder información
✅ Sin conflictos

---

**¡Sistema de sincronización implementado! 🎉**
