-- Administradores
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Agentes de la red
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  version TEXT DEFAULT '1.0.0',
  capabilities TEXT DEFAULT '[]',       -- JSON array
  endpoint TEXT DEFAULT '',
  connection_type TEXT DEFAULT 'websocket', -- websocket | webhook | polling
  status TEXT DEFAULT 'pending',        -- pending | idle | working | sleeping | offline | rejected
  trust_level TEXT DEFAULT 'viewer',    -- viewer | contributor | trusted
  token TEXT UNIQUE,
  owner TEXT DEFAULT '',
  is_external INTEGER DEFAULT 0,
  metadata TEXT DEFAULT '{}',           -- JSON object
  last_seen TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  max_concurrent_tasks INTEGER DEFAULT 1
);

-- Tareas
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  mode TEXT DEFAULT 'auto',             -- broadcast | targeted | auto
  status TEXT DEFAULT 'pending',        -- pending | assigned | in_progress | collaborating | completed | failed | cancelled
  priority INTEGER DEFAULT 5,
  assigned_agents TEXT DEFAULT '[]',    -- JSON array de agent IDs
  result TEXT DEFAULT '{}',             -- JSON resultado consolidado
  context TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Mensajes de tareas (admin <-> agente, agente <-> agente)
CREATE TABLE IF NOT EXISTS task_messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  sender_id TEXT NOT NULL,             -- "admin" o agent ID
  sender_name TEXT DEFAULT '',
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',    -- text | result | error | learning
  created_at TEXT DEFAULT (datetime('now'))
);

-- Base de conocimiento compartida
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  tags TEXT DEFAULT '[]',              -- JSON array
  source_agent_id TEXT DEFAULT '',
  source_agent_name TEXT DEFAULT '',
  source_task_id TEXT DEFAULT '',
  visibility TEXT DEFAULT 'public',    -- public | trusted | private
  relevance_score REAL DEFAULT 1.0,
  times_used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_messages_task ON task_messages(task_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_visibility ON knowledge_entries(visibility);
