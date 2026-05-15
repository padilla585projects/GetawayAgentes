#!/usr/bin/env node
/**
 * GetawayAgentes - Agent with Claude API Integration
 * Demuestra cómo usar Claude API para procesar tareas inteligentemente
 *
 * Requiere: ANTHROPIC_API_KEY en las variables de entorno
 */

const Anthropic = require("@anthropic-ai/sdk");
const http = require("http");
const ws = require("ws");

const GATEWAY_URL = process.argv[2] || "http://localhost:8787";
const WS_URL = GATEWAY_URL.replace("http://", "ws://").replace("https://", "wss://");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY no configurada");
  process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

class ClaudeAgent {
  constructor(name, gatewayUrl) {
    this.name = name;
    this.gatewayUrl = gatewayUrl;
    this.wsUrl = WS_URL;
    this.agentId = null;
    this.token = null;
    this.ws = null;
  }

  async register() {
    console.log(`📝 Registrando agente: ${this.name}`);

    const data = await this._post("/agents/register", {
      name: this.name,
      capabilities: ["claude-api", "reasoning", "nlp"],
      tags: ["claude", "ai", "intelligent"],
    });

    this.agentId = data.id;
    console.log(`✅ Agente registrado: ${this.agentId}`);
  }

  async waitForApproval(maxAttempts = 60) {
    console.log(`⏳ Esperando aprobación (max ${maxAttempts * 5}s)...`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const agent = await this._get(`/agents/${this.agentId}`);

      if (agent.status === "idle") {
        this.token = agent.token;
        console.log(`✅ Agente aprobado! Token: ${this.token.substring(0, 20)}...`);
        return true;
      } else if (agent.status === "rejected") {
        console.log("❌ Agente rechazado");
        return false;
      }

      await new Promise((r) => setTimeout(r, 5000));
    }

    console.log("⏱️ Timeout esperando aprobación");
    return false;
  }

  async connectWebSocket() {
    console.log(`🔌 Conectando a WebSocket: ${this.wsUrl}/ws`);

    return new Promise((resolve) => {
      this.ws = new ws.WebSocket(
        `${this.wsUrl}/ws?role=agent&token=${this.token}`
      );

      this.ws.on("open", () => {
        console.log("✅ WebSocket conectado");
        resolve(true);
      });

      this.ws.on("message", (message) => this.handleMessage(message));
      this.ws.on("error", (error) => {
        console.error("❌ WebSocket error:", error);
        resolve(false);
      });
      this.ws.on("close", () => console.log("⚠️ WebSocket cerrado"));
    });
  }

  async handleMessage(message) {
    const data = JSON.parse(message);

    if (data.type === "task_assigned") {
      await this.handleTask(data);
    } else if (data.type === "ping") {
      this.ws.send(JSON.stringify({ type: "pong" }));
    } else {
      console.log(`📨 Mensaje: ${data.type}`);
    }
  }

  async handleTask(taskData) {
    const taskId = taskData.task_id;
    const title = taskData.title || "Sin título";
    const description = taskData.description || "";

    console.log(`\n🎯 TAREA ASIGNADA: ${title}`);
    console.log(`   ID: ${taskId}`);
    console.log(`   Descripción: ${description}`);

    try {
      console.log("🧠 Procesando con Claude API...");

      // Usar Claude para analizar y procesar la tarea
      const message = await client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `Tarea para procesar:
Título: ${title}
Descripción: ${description}

Por favor proporciona un análisis breve (2-3 párrafos) de cómo abordarías esta tarea y qué resultado esperarías.`,
          },
        ],
      });

      const analysis = message.content[0].text;

      // Enviar resultado
      const result = {
        type: "task_result",
        task_id: taskId,
        agent_id: this.agentId,
        status: "completed",
        result: {
          output: analysis,
          model: "claude-opus-4-7",
          tokens: {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens,
          },
          timestamp: new Date().toISOString(),
        },
      };

      this.ws.send(JSON.stringify(result));
      console.log(`✅ Resultado enviado para tarea ${taskId}`);
    } catch (error) {
      console.error("❌ Error procesando tarea:", error);

      const errorResult = {
        type: "task_result",
        task_id: taskId,
        agent_id: this.agentId,
        status: "failed",
        result: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      };

      this.ws.send(JSON.stringify(errorResult));
    }
  }

  async run() {
    try {
      await this.register();
      if (!this.agentId) {
        console.log("❌ Error en registro");
        return;
      }

      if (!(await this.waitForApproval())) {
        console.log("❌ Agente no fue aprobado");
        return;
      }

      if (!(await this.connectWebSocket())) {
        console.log("❌ Error conectando WebSocket");
        return;
      }

      console.log(`🚀 Agente ${this.name} listo para tareas`);
      console.log("💡 Usa Claude API para procesar cada tarea inteligentemente");
    } catch (error) {
      console.error("❌ Error en run():", error);
    }
  }

  async _post(path, body) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      const url = new URL(path, this.gatewayUrl);

      const req = http.request(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve(JSON.parse(data));
          });
        }
      );

      req.on("error", reject);
      req.write(postData);
      req.end();
    });
  }

  async _get(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.gatewayUrl);

      http.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve(JSON.parse(data));
        });
      }).on("error", reject);
    });
  }
}

async function main() {
  console.log("🤖 Agente Claude API GetawayAgentes");
  console.log(`Gateway: ${GATEWAY_URL}`);
  console.log("Modelo: claude-opus-4-7\n");

  const agent = new ClaudeAgent("Agente Claude API", GATEWAY_URL);
  await agent.run();
}

main().catch(console.error);
