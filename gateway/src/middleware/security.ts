import { Context, MiddlewareHandler } from "hono";
import type { AppContext } from "../models/types";

// Rate limiting simple en KV
interface RateLimit {
  requests: number;
  resetTime: number;
}

export const rateLimit =
  (maxRequests: number, windowMs: number): MiddlewareHandler<AppContext> =>
  async (c, next) => {
    const ip = c.req.header("cf-connecting-ip") || "unknown";
    const key = `ratelimit:${ip}`;

    try {
      const current = (await c.env.KV.get(key, "json")) as RateLimit | null;
      const now = Date.now();

      if (current && now < current.resetTime) {
        if (current.requests >= maxRequests) {
          return c.json({ error: "Too many requests" }, 429);
        }
        current.requests++;
        await c.env.KV.put(key, JSON.stringify(current), {
          expirationTtl: Math.ceil((current.resetTime - now) / 1000),
        });
      } else {
        await c.env.KV.put(
          key,
          JSON.stringify({ requests: 1, resetTime: now + windowMs }),
          { expirationTtl: Math.ceil(windowMs / 1000) }
        );
      }
    } catch (e) {
      console.error("Rate limit error:", e);
    }

    await next();
  };

// Validación de inputs
export const validateJSON = (): MiddlewareHandler<AppContext> =>
  async (c, next) => {
    if (
      c.req.method !== "GET" &&
      c.req.method !== "HEAD" &&
      c.req.method !== "OPTIONS"
    ) {
      try {
        const contentType = c.req.header("content-type") || "";
        if (contentType.includes("application/json")) {
          const body = await c.req.text();

          // Validar JSON válido
          if (body) {
            try {
              JSON.parse(body);
            } catch {
              return c.json({ error: "Invalid JSON" }, 400);
            }
          }

          // Limitar tamaño
          if (body.length > 100000) {
            // 100KB
            return c.json({ error: "Payload too large" }, 413);
          }
        }
      } catch (e) {
        console.error("JSON validation error:", e);
      }
    }

    await next();
  };

// CORS mejorado
export const corsHeaders = () => {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
};

export const cors = (): MiddlewareHandler<AppContext> => async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return c.text("", 204, corsHeaders());
  }

  await next();

  // Agregar headers CORS a la respuesta
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    c.header(key, value);
  });
};

// Audit logging
interface AuditLog {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  ip: string;
  userId?: string;
  duration: number;
  error?: string;
}

export const auditLog = (): MiddlewareHandler<AppContext> => async (
  c,
  next
) => {
  const startTime = Date.now();
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const path = c.req.path;
  const method = c.req.method;

  try {
    await next();

    const duration = Date.now() - startTime;
    const status = c.res.status;

    // Solo log si es apropiado
    if (
      method !== "GET" ||
      path.includes("/tasks") ||
      path.includes("/agents")
    ) {
      const log: AuditLog = {
        timestamp: new Date().toISOString(),
        method,
        path,
        status,
        ip,
        userId: (c as any).auth?.sub,
        duration,
      };

      // Guardar en D1 (implementar tabla de auditoría)
      console.log("[AUDIT]", JSON.stringify(log));
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      method,
      path,
      status: 500,
      ip,
      userId: (c as any).auth?.sub,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    console.log("[AUDIT ERROR]", JSON.stringify(log));
    throw error;
  }
};

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

// Validar IDs (nanoid)
export const isValidId = (id: string): boolean => {
  return /^[a-zA-Z0-9_-]{21}$/.test(id);
};

// Validar emails
export const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 255;
};

// Validar URLs
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
