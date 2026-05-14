# Reglas por Plataforma

Instrucciones claras de qué hacer en cada plataforma para no perder continuidad en el proyecto.

---

## 📱 DESDE MÓVIL (Android)

### Qué PUEDES hacer:
- ✅ Leer documentación (CLAUDE.md, DEPLOY.md, PROGRESS.md)
- ✅ Revisar código y entender la arquitectura
- ✅ Planificar cambios y hacer notas
- ✅ Crear tareas y issues en GitHub
- ✅ Ver estado del proyecto en GitHub
- ✅ Aprobar/revisar PRs en GitHub

### Qué NO PUEDES hacer:
- ❌ Instalar paquetes (`npm install`)
- ❌ Ejecutar scripts (`bash deploy.sh`, `npm run dev`)
- ❌ Crear credenciales de Cloudflare (wrangler login)
- ❌ Hacer cambios que requieren compilación
- ❌ Desplegar a producción

### Si estás en móvil y tienes ideas:

**1. Lee PROGRESS.md para entender qué falta**
```
Los próximos pasos son:
- A) Deploy a Cloudflare (requiere PC)
- B) Mejorar dashboard (puedo planificar aquí)
- C) Agentes en Python/Go (puedo diseñar aquí)
- D) Seguridad (puedo revisar en PC)
```

**2. Planifica en una nota o issue:**
```
Abrir GitHub → Issues → "New issue"
Título: "PLAN: Mejorar dashboard con gráficas"
Descripción: Tus ideas de qué agregar
```

**3. Cuando llegues a PC:**
```
Lee tu issue y dile a Claude Code:
"Implementa lo que planifiqué en el issue #X"
```

### Flujo desde móvil:
```
Móvil: Leer + Planificar + Crear issue
  ↓
PC: Implementar + Testear + Deploy
  ↓
Móvil: Revisar resultado en GitHub
```

---

## 💻 DESDE PC

### Qué PUEDES hacer (TODO):
- ✅ Leer y escribir código
- ✅ Instalar paquetes
- ✅ Ejecutar scripts y comandos
- ✅ Desplegar a Cloudflare
- ✅ Probar localmente
- ✅ Hacer commits y pushes
- ✅ Crear y revisar PRs

### Flujo recomendado en PC:

**PRIMERO: Setup inicial**
```bash
git checkout claude/add-claude-documentation-KdUQt
cat PROGRESS.md                    # Leer qué está hecho
cat DEPLOY.md                       # Leer instrucciones
```

**SEGUNDO: Si es la primera vez**
```bash
wrangler login                      # Una sola vez
bash deploy.sh                      # Deploy automático
# Luego seguir instrucciones para Pages
```

**TERCERO: Después de cada paso**
```bash
git status                          # Ver cambios
git add .
git commit -m "descripción"
git push                            # Ir a GitHub
```

**CUARTO: Actualizar PROGRESS.md**
```
Edita PROGRESS.md y marca como [x] lo que completaste
git commit -am "Actualizar PROGRESS.md"
git push
```

---

## 🔄 Ciclo Completo: Móvil + PC

### Escenario 1: Planificar desde móvil, implementar desde PC

```
MÓVIL (Leo PROGRESS.md):
  1. Veo que falta "Dashboard con gráficas"
  2. Pienso qué gráficas agregar
  3. Creo issue en GitHub con mis ideas
  
PC (Cuando llego):
  4. Abro Claude Code
  5. Digo: "Implementa el issue #X: Agregar gráficas al dashboard"
  6. Claude implementa, testea, hace commit
  7. Hago git push
  
MÓVIL (Más tarde):
  8. Veo la PR en GitHub
  9. Reviso cambios y apruebo
```

### Escenario 2: Trabajo directo desde PC

```
PC:
  1. Abre Claude Code
  2. git checkout claude/add-claude-documentation-KdUQt
  3. Lee PROGRESS.md
  4. Dile a Claude: "Continúa con el punto B: Mejorar dashboard"
  5. Claude implementa, testea, hace commit, pushes
  
MÓVIL (cuando quiero revisar):
  6. GitHub → Pull Requests → Ver cambios
  7. Revisar código en el navegador
```

### Escenario 3: Desplegar a producción

```
PC SÓLO:
  1. Asegúrate de estar en la rama correcta
  2. Ejecuta: bash deploy.sh
  3. Sigue las instrucciones para Cloudflare Pages
  4. Prueba en producción
  5. Haz merge a main: git merge claude/add-claude-documentation-KdUQt
  6. git push
  
MÓVIL:
  7. GitHub → Revisa que esté en main
  8. Verifica el deploy en Cloudflare Dashboard
```

---

## 📋 Checklist por Sección

### Antes de cambiar de plataforma:

**Desde MÓVIL, antes de apagar:**
- [ ] Leí PROGRESS.md
- [ ] Abrí un issue si tengo ideas
- [ ] Verifiqué en GitHub que los cambios de PC estén pusheados
- [ ] Anoté qué debo hacer cuando esté en PC

**Desde PC, antes de irme:**
- [ ] Commiteé todos los cambios (`git status` = clean)
- [ ] Hice `git push` (verificar en GitHub)
- [ ] Actualicé PROGRESS.md con lo que hice
- [ ] Anoté qué continúa en el siguiente paso

---

## 🎯 Estados del Proyecto

### ⏳ Pendiente Deploy
```
Estás aquí ahora.
PC: Ejecuta bash deploy.sh
Luego: Deploy Pages desde Cloudflare Dashboard
```

### ✅ En Producción (después de deploy)
```
MÓVIL: Puedo probar en https://getaway-web.<account>.pages.dev
PC: Puedo hacer cambios y pushear
Ambas: Podemos monitorear en Cloudflare Dashboard
```

### 🔄 En Desarrollo (próximos pasos)
```
B) Dashboard: Gráficas y estadísticas
C) Agentes: Python, Go
D) Seguridad: Rate limiting, validación
...
```

---

## 💬 Cómo Comunicarte Entre Plataformas

### Usa el archivo NOTES.md para notas rápidas:

**Desde MÓVIL:**
```
Edita NOTES.md en GitHub (directamente) o abre un issue:
- "TODO: Cuando estés en PC, implementa X"
- "IDEA: Agregar gráfica de Y"
- "BUG: El chat no actualiza cuando..."
```

**Desde PC:**
```
Lee NOTES.md y actualízalo:
- Marca lo que completaste
- Agrega nuevas notas para móvil
- Hace commit
```

### Usa Issues y Projects:

**Desde MÓVIL:**
- Crear issue con una feature
- Comentar en PRs
- Ver el project board

**Desde PC:**
- Implementar features de issues
- Crear PRs
- Actualizar project board

---

## ⚠️ Cosas que NO hacer

### NUNCA (desde cualquier plataforma):
- ❌ Commitear sin mensaje claro
- ❌ Pushear a `main` sin revisar (siempre a la rama de feature)
- ❌ Olvidar actualizar PROGRESS.md
- ❌ Hacer deploy sin testear primero
- ❌ Perder credenciales (SECRET_KEY, tokens)

### NUNCA desde MÓVIL:
- ❌ Intentar ejecutar `npm run dev`
- ❌ Editar archivos grandes (usa GitHub web solo para lo urgente)

### NUNCA desde PC:
- ❌ Resetear cambios sin backup (`git reset --hard`)
- ❌ Force push a main (`git push --force`)

---

## 📞 Resumen Rápido

| Acción | Móvil | PC |
|--------|-------|-----|
| Leer documentación | ✅ | ✅ |
| Planificar cambios | ✅ | ✅ |
| Escribir código | ❌ | ✅ |
| Testear localmente | ❌ | ✅ |
| Ejecutar deploy | ❌ | ✅ |
| Revisar en GitHub | ✅ | ✅ |
| Hacer commits | ❌ | ✅ |
| Ver código en producción | ✅ | ✅ |

---

## 🚀 Próxima Sesión

**Si vuelves desde MÓVIL:**
1. Lee PROGRESS.md (qué está hecho)
2. Lee PLATFORM_RULES.md (este archivo)
3. Crea un issue si tienes ideas
4. Espera a estar en PC para implementar

**Si vuelves desde PC:**
1. Lee PROGRESS.md (qué está hecho)
2. Ejecuta `git checkout claude/add-claude-documentation-KdUQt`
3. Dile a Claude: "Continúa con el siguiente paso de PROGRESS.md"
4. Trabaja, testea, commit, push
5. Actualiza PROGRESS.md antes de irte

---

**¡Sigue estas reglas y nunca perderás continuidad! 🎯**
