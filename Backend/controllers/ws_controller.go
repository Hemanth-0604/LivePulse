package controllers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"livepulse-backend/services"
)

var upgrader = websocket.Upgrader{
	// Tighten this to your real frontend origin before you deploy publicly.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// hubEntry holds every locally-connected client for one poll code and the
// goroutine that relays Redis Pub/Sub messages out to them.
type hubEntry struct {
	mu      sync.Mutex
	clients map[*websocket.Conn]bool
}

var (
	hubs   = map[string]*hubEntry{}
	hubsMu sync.Mutex
)

func getHub(code string) *hubEntry {
	hubsMu.Lock()
	defer hubsMu.Unlock()
	h, ok := hubs[code]
	if !ok {
		h = &hubEntry{clients: map[*websocket.Conn]bool{}}
		hubs[code] = h
		go subscribeAndBroadcast(code, h)
	}
	return h
}

// subscribeAndBroadcast is the piece that makes this horizontally scalable:
// it listens to Redis, not to other in-process goroutines, so a vote landing
// on one server instance still reaches watchers connected to another.
func subscribeAndBroadcast(code string, h *hubEntry) {
	ctx := context.Background()
	sub := services.Subscribe(ctx, code)
	defer sub.Close()

	for msg := range sub.Channel() {
		h.mu.Lock()
		for conn := range h.clients {
			if err := conn.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
				conn.Close()
				delete(h.clients, conn)
			}
		}
		h.mu.Unlock()
	}
}

// PollSocket upgrades the connection and streams live tallies for one poll.
func PollSocket(c *gin.Context) {
	code := c.Param("code")
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("ws upgrade error:", err)
		return
	}

	h := getHub(code)
	h.mu.Lock()
	h.clients[conn] = true
	h.mu.Unlock()

	// Send the current snapshot immediately so a client that connects mid-poll
	// doesn't have to wait for the next vote to see accurate numbers.
	if counts, err := services.GetTally(context.Background(), code); err == nil {
		var total int64
		for _, v := range counts {
			total += v
		}
		snapshot, _ := json.Marshal(map[string]interface{}{
			"type": "tally", "counts": counts, "total": total,
		})
		conn.WriteMessage(websocket.TextMessage, snapshot)
	}

	// Read pump exists only to detect disconnects — we don't expect the
	// client to send anything back over this socket.
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			h.mu.Lock()
			delete(h.clients, conn)
			h.mu.Unlock()
			conn.Close()
			break
		}
	}
}
