package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type Agent struct {
	ID       string
	Name     string
	Token    string
	GatewayURL string
}

type RegisterRequest struct {
	Name         string   `json:"name"`
	Capabilities []string `json:"capabilities"`
	Tags         []string `json:"tags"`
}

type AgentData struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Token  string `json:"token"`
}

type TaskMessage struct {
	Type   string `json:"type"`
	TaskID string `json:"task_id"`
	Title  string `json:"title"`
}

type TaskResult struct {
	Type      string                 `json:"type"`
	TaskID    string                 `json:"task_id"`
	AgentID   string                 `json:"agent_id"`
	Status    string                 `json:"status"`
	Result    map[string]interface{} `json:"result"`
}

func (a *Agent) Register() error {
	fmt.Printf("📝 Registrando agente: %s\n", a.Name)

	reqBody := RegisterRequest{
		Name:         a.Name,
		Capabilities: []string{"go", "concurrent", "compiled"},
		Tags:         []string{"go", "example"},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	resp, err := http.Post(
		fmt.Sprintf("%s/agents/register", a.GatewayURL),
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&data)
	a.ID = data["id"].(string)

	fmt.Printf("✅ Agente registrado: %s\n", a.ID)
	return nil
}

func (a *Agent) WaitForApproval(maxAttempts int) error {
	fmt.Printf("⏳ Esperando aprobación (max %ds)...\n", maxAttempts*5)

	for attempt := 0; attempt < maxAttempts; attempt++ {
		resp, err := http.Get(fmt.Sprintf("%s/agents/%s", a.GatewayURL, a.ID))
		if err != nil {
			return err
		}

		var agentData AgentData
		json.NewDecoder(resp.Body).Decode(&agentData)
		resp.Body.Close()

		if agentData.Status == "idle" {
			a.Token = agentData.Token
			fmt.Printf("✅ Agente aprobado! Token: %s...\n", a.Token[:20])
			return nil
		} else if agentData.Status == "rejected" {
			return fmt.Errorf("❌ Agente rechazado")
		}

		time.Sleep(5 * time.Second)
	}

	return fmt.Errorf("⏱️ Timeout esperando aprobación")
}

func (a *Agent) ConnectWebSocket() (*websocket.Conn, error) {
	wsURL := strings.Replace(a.GatewayURL, "http://", "ws://", 1)
	wsURL = strings.Replace(wsURL, "https://", "wss://", 1)
	wsURL = fmt.Sprintf("%s/ws?role=agent&token=%s", wsURL, a.Token)

	fmt.Printf("🔌 Conectando a WebSocket: %s\n", wsURL)

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	ws, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		return nil, err
	}

	fmt.Println("✅ WebSocket conectado")
	return ws, nil
}

func (a *Agent) HandleTask(ws *websocket.Conn, msg map[string]interface{}) error {
	taskID := msg["task_id"].(string)
	title := msg["title"].(string)

	fmt.Printf("\n🎯 TAREA ASIGNADA: %s\n", title)
	fmt.Printf("   ID: %s\n", taskID)

	// Simular procesamiento
	time.Sleep(2 * time.Second)

	// Enviar resultado
	result := TaskResult{
		Type:    "task_result",
		TaskID:  taskID,
		AgentID: a.ID,
		Status:  "completed",
		Result: map[string]interface{}{
			"output":    "Tarea procesada exitosamente por agente Go",
			"duration":  2.0,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		},
	}

	err := ws.WriteJSON(result)
	if err == nil {
		fmt.Printf("✅ Resultado enviado para tarea %s\n", taskID)
	}

	return err
}

func (a *Agent) ProcessMessages(ws *websocket.Conn) error {
	for {
		var msg map[string]interface{}
		err := ws.ReadJSON(&msg)

		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				return err
			}
			return nil
		}

		msgType := msg["type"].(string)

		if msgType == "task_assigned" {
			a.HandleTask(ws, msg)
		} else if msgType == "ping" {
			ws.WriteJSON(map[string]string{"type": "pong"})
		} else {
			fmt.Printf("📨 Mensaje: %s\n", msgType)
		}
	}
}

func (a *Agent) Run() error {
	// Registro
	if err := a.Register(); err != nil {
		return fmt.Errorf("❌ Error en registro: %v", err)
	}

	// Esperar aprobación
	if err := a.WaitForApproval(60); err != nil {
		return err
	}

	// Conectar WebSocket
	ws, err := a.ConnectWebSocket()
	if err != nil {
		return fmt.Errorf("❌ Error conectando WebSocket: %v", err)
	}
	defer ws.Close()

	// Procesar mensajes
	fmt.Printf("🚀 Agente %s listo para tareas\n", a.Name)

	// Capturar Ctrl+C
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	done := make(chan error, 1)
	go func() {
		done <- a.ProcessMessages(ws)
	}()

	select {
	case err := <-done:
		return err
	case <-interrupt:
		fmt.Println("\n👋 Cerrando agente...")
		ws.WriteMessage(websocket.CloseMessage, []byte{})
		return nil
	}
}

func main() {
	gatewayURL := flag.String("gateway", "http://localhost:8787", "URL del gateway")
	flag.Parse()

	if len(flag.Args()) > 0 {
		*gatewayURL = flag.Args()[0]
	}

	fmt.Println("🐹 Agente Go GetawayAgentes")
	fmt.Printf("Gateway: %s\n", *gatewayURL)

	agent := &Agent{
		Name:       "Agente Go",
		GatewayURL: *gatewayURL,
	}

	if err := agent.Run(); err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		os.Exit(1)
	}
}
