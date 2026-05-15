#!/bin/bash

set -e

echo "🚀 Deploy GetawayAgentes a Cloudflare"
echo "========================================"
echo ""

# Verificar que wrangler está autenticado
echo "✅ Verificando autenticación con Cloudflare..."
if ! wrangler whoami > /dev/null 2>&1; then
  echo "❌ No estás autenticado. Ejecuta primero:"
  echo "   wrangler login"
  exit 1
fi
echo "✅ Autenticado"
echo ""

# GATEWAY DEPLOYMENT
echo "📦 Desplegando Gateway..."
echo "=========================="
echo ""

cd gateway

echo "1️⃣ Creando base de datos D1..."
D1_ID=$(wrangler d1 create getaway-db --yes 2>&1 | grep -oP '(?<=database_id = ")[^"]*' | head -1 || echo "")

if [ -z "$D1_ID" ]; then
  echo "⚠️  D1 database ya existe. Buscando ID..."
  # Si ya existe, el usuario debe proporcionar el ID
  read -p "Ingresa tu D1 database_id (o presiona Enter para continuar): " D1_ID
  if [ -z "$D1_ID" ]; then
    echo "⚠️  Sin D1 ID. Continuando sin actualizar..."
  fi
fi

if [ ! -z "$D1_ID" ]; then
  echo "   Database ID: $D1_ID"
  sed -i.bak "s|database_id = \".*\"|database_id = \"$D1_ID\"|" wrangler.toml
  echo "   ✅ wrangler.toml actualizado"
fi

echo ""
echo "2️⃣ Creando namespace KV..."
KV_ID=$(wrangler kv namespace create KV --yes 2>&1 | grep -oP '(?<=id = ")[^"]*' | head -1 || echo "")

if [ -z "$KV_ID" ]; then
  echo "⚠️  KV namespace ya existe. Buscando ID..."
  read -p "Ingresa tu KV namespace id (o presiona Enter para continuar): " KV_ID
  if [ -z "$KV_ID" ]; then
    echo "⚠️  Sin KV ID. Continuando sin actualizar..."
  fi
fi

if [ ! -z "$KV_ID" ]; then
  echo "   KV ID: $KV_ID"
  sed -i.bak "s|id = \".*\"|id = \"$KV_ID\"|" wrangler.toml
  echo "   ✅ wrangler.toml actualizado"
fi

echo ""
echo "3️⃣ Configurando SECRET_KEY..."
read -sp "Ingresa una contraseña fuerte para SECRET_KEY: " SECRET_KEY
echo ""
echo "$SECRET_KEY" | wrangler secret put SECRET_KEY
echo "   ✅ SECRET_KEY configurado"

echo ""
echo "4️⃣ Aplicando migraciones..."
wrangler d1 migrations apply getaway-db
echo "   ✅ Migraciones aplicadas"

echo ""
echo "5️⃣ Desplegando Gateway en Workers..."
GATEWAY_URL=$(wrangler deploy 2>&1 | grep -oP 'https://[^\s]+' | head -1)
if [ -z "$GATEWAY_URL" ]; then
  GATEWAY_URL="https://getaway-gateway.<tu-account>.workers.dev"
fi
echo "   ✅ Gateway desplegado en: $GATEWAY_URL"

cd ..

echo ""
echo "🌐 Desplegando Web..."
echo "====================="
echo ""

cd web

echo "1️⃣ Instalando dependencias..."
npm install
echo "   ✅ Dependencias instaladas"

echo ""
echo "2️⃣ Configurando variables de entorno..."
cat > .env.local << EOF
NEXT_PUBLIC_GATEWAY_URL=$GATEWAY_URL
NEXT_PUBLIC_WS_URL=$(echo $GATEWAY_URL | sed 's|https://|wss://|')
EOF
echo "   ✅ .env.local creado"
cat .env.local

echo ""
echo "3️⃣ Buildando Next.js..."
npm run build
echo "   ✅ Build completado"

echo ""
echo "4️⃣ Desplegando en Cloudflare Pages..."
echo ""
echo "⚠️  Para desplegar la web en Cloudflare Pages:"
echo ""
echo "   Opción A - Desde el dashboard:"
echo "   1. Ve a https://dash.cloudflare.com"
echo "   2. Pages → Create a project"
echo "   3. Connect to Git → Selecciona GetawayAgentes"
echo "   4. En Build settings:"
echo "      - Framework: Next.js"
echo "      - Build command: npm run build"
echo "      - Build output directory: .next"
echo "   5. Environment variables:"
echo "      NEXT_PUBLIC_GATEWAY_URL=$GATEWAY_URL"
echo "      NEXT_PUBLIC_WS_URL=$(echo $GATEWAY_URL | sed 's|https://|wss://|')"
echo "   6. Deploy"
echo ""
echo "   Opción B - Desde CLI (si tienes wrangler configurado):"
echo "   npm install -D @cloudflare/next-on-pages"
echo "   npm run build"
echo "   npx wrangler pages deploy out"
echo ""

cd ..

echo ""
echo "✅ DEPLOY COMPLETADO"
echo "===================="
echo ""
echo "Gateway URL: $GATEWAY_URL"
echo "Gateway Admin:"
echo "  - Login: POST $GATEWAY_URL/auth/login"
echo "  - Setup (dev): POST $GATEWAY_URL/auth/setup"
echo ""
echo "Próximos pasos:"
echo "1. Desplega la web en Cloudflare Pages (ver instrucciones arriba)"
echo "2. Crea el primer admin: curl -X POST $GATEWAY_URL/auth/setup \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"admin\",\"email\":\"admin@example.com\",\"password\":\"tu-contraseña\"}'"
echo "3. Prueba con el agente de ejemplo: node agent-example.js $GATEWAY_URL"
echo ""
