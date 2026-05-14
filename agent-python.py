#!/usr/bin/env python3
"""
GetawayAgentes - Agent Python Example
Demuestra cómo conectar un agente escrito en Python al gateway.
"""

import asyncio
import json
import aiohttp
import websockets
import sys
from datetime import datetime
from typing import Optional

GATEWAY_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8787"
WS_URL = GATEWAY_URL.replace("http://", "ws://").replace("https://", "wss://")

class PythonAgent:
    def __init__(self, name: str, gateway_url: str):
        self.name = name
        self.gateway_url = gateway_url
        self.ws_url = gateway_url.replace("http://", "ws://").replace("https://", "wss://")
        self.agent_id: Optional[str] = None
        self.token: Optional[str] = None
        self.ws = None

    async def register(self):
        """Registra el agente en el gateway"""
        print(f"📝 Registrando agente: {self.name}")
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.gateway_url}/agents/register",
                json={
                    "name": self.name,
                    "capabilities": ["python", "async", "ml"],
                    "tags": ["python", "example"],
                },
            ) as resp:
                data = await resp.json()
                self.agent_id = data.get("id")
                print(f"✅ Agente registrado: {self.agent_id}")

    async def wait_for_approval(self, max_attempts: int = 60):
        """Espera a que el agente sea aprobado (polling cada 5s)"""
        print(f"⏳ Esperando aprobación (max {max_attempts * 5}s)...")
        async with aiohttp.ClientSession() as session:
            for attempt in range(max_attempts):
                async with session.get(
                    f"{self.gateway_url}/agents/{self.agent_id}"
                ) as resp:
                    agent_data = await resp.json()
                    if agent_data.get("status") == "idle":
                        self.token = agent_data.get("token")
                        print(f"✅ Agente aprobado! Token: {self.token[:20]}...")
                        return True
                    elif agent_data.get("status") == "rejected":
                        print(f"❌ Agente rechazado")
                        return False
                await asyncio.sleep(5)
        print(f"⏱️ Timeout esperando aprobación")
        return False

    async def connect_websocket(self):
        """Conecta al WebSocket del gateway"""
        print(f"🔌 Conectando a WebSocket: {self.ws_url}/ws")
        try:
            self.ws = await websockets.connect(
                f"{self.ws_url}/ws?role=agent&token={self.token}",
                ping_interval=20,
                ping_timeout=10,
            )
            print(f"✅ WebSocket conectado")
        except Exception as e:
            print(f"❌ Error conectando WebSocket: {e}")
            return False
        return True

    async def process_messages(self):
        """Procesa mensajes del gateway"""
        try:
            async for message in self.ws:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "task_assigned":
                    await self.handle_task(data)
                elif msg_type == "ping":
                    await self.ws.send(json.dumps({"type": "pong"}))
                else:
                    print(f"📨 Mensaje: {msg_type}")
        except websockets.exceptions.ConnectionClosed:
            print(f"⚠️ WebSocket cerrado")
        except Exception as e:
            print(f"❌ Error procesando mensajes: {e}")

    async def handle_task(self, task_data: dict):
        """Procesa una tarea asignada"""
        task_id = task_data.get("task_id")
        title = task_data.get("title", "Sin título")

        print(f"\n🎯 TAREA ASIGNADA: {title}")
        print(f"   ID: {task_id}")

        # Simular procesamiento
        await asyncio.sleep(2)

        # Enviar resultado
        result = {
            "type": "task_result",
            "task_id": task_id,
            "agent_id": self.agent_id,
            "status": "completed",
            "result": {
                "output": f"Tarea procesada exitosamente por agente Python",
                "duration": 2.0,
                "timestamp": datetime.utcnow().isoformat(),
            },
        }

        await self.ws.send(json.dumps(result))
        print(f"✅ Resultado enviado para tarea {task_id}")

    async def run(self):
        """Ejecuta el ciclo principal del agente"""
        try:
            # Registro
            await self.register()
            if not self.agent_id:
                print("❌ Error en registro")
                return

            # Esperar aprobación
            if not await self.wait_for_approval():
                print("❌ Agente no fue aprobado")
                return

            # Conectar WebSocket
            if not await self.connect_websocket():
                print("❌ Error conectando WebSocket")
                return

            # Procesar mensajes
            print(f"🚀 Agente {self.name} listo para tareas")
            await self.process_messages()
        except Exception as e:
            print(f"❌ Error en run(): {e}")
        finally:
            if self.ws:
                await self.ws.close()

async def main():
    agent = PythonAgent(
        name="Agente Python",
        gateway_url=WS_URL.replace("ws://", "http://").replace("wss://", "https://"),
    )
    await agent.run()

if __name__ == "__main__":
    print(f"🐍 Agente Python GetawayAgentes")
    print(f"Gateway: {GATEWAY_URL}")
    asyncio.run(main())
