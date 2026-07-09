-- Migración 0002: Chat y mensajes globales
-- Tabla de mensajes de chat (admin ↔ agentes)
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,              -- 'admin' o agent ID
  sender_name TEXT NOT NULL,
  sender_role TEXT DEFAULT 'admin',     -- 'admin' o 'agent'
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'general',       -- 'general' o agent_id específico
  target_agent_id TEXT DEFAULT NULL,    -- NULL = broadcast, agent_id = directo
  message_type TEXT DEFAULT 'text',     -- 'text' | 'system' | 'learning' | 'improvement'
  metadata TEXT DEFAULT '{}',           -- JSON extra (tags, task_ref, etc.)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel);
CREATE INDEX IF NOT EXISTS idx_chat_target ON chat_messages(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
