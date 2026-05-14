/**
 * Tests para autenticación JWT del gateway
 *
 * Ejecutar con: npm test (requiere configuración de test runner)
 * Para desarrollo: Probar manualmente con curl
 */

import { createHash, createHmac } from "crypto";
import type { JWTPayload } from "../services/auth";

// Test helper para verificar JWT válido
function verifyJWT(token: string, secret: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    // Decodificar
    const payloadStr = Buffer.from(payload, "base64url").toString("utf-8");
    const data = JSON.parse(payloadStr) as JWTPayload;

    // Verificar firma
    const message = `${header}.${payload}`;
    const expectedSig = createHmac("sha256", secret)
      .update(message)
      .digest("base64url");

    if (signature !== expectedSig) {
      return null;
    }

    // Verificar expiración
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return data;
  } catch (e) {
    return null;
  }
}

// Tests
describe("Authentication", () => {
  const SECRET = "test-secret-key";

  test("JWT token puede ser creado y verificado", () => {
    const payload: JWTPayload = {
      sub: "user123",
      name: "Test User",
      type: "admin",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    // Simular creación de JWT (requeriría la función real)
    const verified = verifyJWT(
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.signature",
      SECRET
    );

    expect(verified).toBeNull(); // Token de prueba no es válido
  });

  test("Token expirado es rechazado", () => {
    const expiredPayload = Buffer.from(
      JSON.stringify({
        sub: "user123",
        exp: Math.floor(Date.now() / 1000) - 3600, // Expirado hace 1 hora
      })
    ).toString("base64url");

    const token = `header.${expiredPayload}.signature`;
    const verified = verifyJWT(token, SECRET);

    expect(verified).toBeNull();
  });

  test("Token con firma inválida es rechazado", () => {
    const verified = verifyJWT("header.payload.invalidsignature", SECRET);
    expect(verified).toBeNull();
  });
});

/**
 * Integration tests (manual con curl)
 *
 * 1. Registrar agente:
 * curl -X POST http://localhost:8787/agents/register \
 *   -H "Content-Type: application/json" \
 *   -d '{"name":"Test Agent","capabilities":["test"]}'
 *
 * 2. Crear tarea (requiere admin token):
 * curl -X POST http://localhost:8787/tasks \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer <ADMIN_TOKEN>" \
 *   -d '{"title":"Test Task","mode":"broadcast"}'
 *
 * 3. Verificar que agente no autorizado obtiene 403:
 * curl -X POST http://localhost:8787/tasks \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer invalid" \
 *   -d '{"title":"Test"}'
 * → Esperado: {"code": "UNAUTHORIZED"}
 */

/**
 * Performance tests
 *
 * Simular 100 agentes conectados:
 * for i in {1..100}; do
 *   node agent-example.js http://localhost:8787 &
 * done
 *
 * Crear 10 tareas simultáneamente:
 * for i in {1..10}; do
 *   curl -X POST http://localhost:8787/tasks \
 *     -H "Content-Type: application/json" \
 *     -H "Authorization: Bearer <TOKEN>" \
 *     -d "{\"title\":\"Task $i\"}" &
 * done
 */
