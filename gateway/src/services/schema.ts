// Asegura que todas las tablas existan en la base de datos (idempotente).
// Se ejecuta al iniciar el worker para no depender de migraciones externas.

const SCHEMA_STATEMENTS = `
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  hashed_password TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  capabilities TEXT DEFAULT '[]',
  endpoint TEXT,
  connection_type TEXT DEFAULT 'websocket',
  owner TEXT DEFAULT '',
  is_external INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  trust_level TEXT DEFAULT 'viewer',
  token TEXT,
  metadata TEXT DEFAULT '{}',
  last_seen TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  mode TEXT DEFAULT 'broadcast',
  priority INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending',
  assigned_agents TEXT DEFAULT '[]',
  context TEXT DEFAULT '{}',
  result TEXT DEFAULT '{}',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT,
  sender_role TEXT DEFAULT 'agent',
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT DEFAULT '[]',
  source_agent_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT DEFAULT 'admin',
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'general',
  target_agent_id TEXT DEFAULT NULL,
  message_type TEXT DEFAULT 'text',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel);
CREATE INDEX IF NOT EXISTS idx_chat_target ON chat_messages(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);

CREATE TABLE IF NOT EXISTS improvement_proposals (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  related_capabilities TEXT DEFAULT '[]',
  evidence TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  implementation_notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_improvements_status ON improvement_proposals(status);
CREATE INDEX IF NOT EXISTS idx_improvements_agent ON improvement_proposals(agent_id);
CREATE INDEX IF NOT EXISTS idx_improvements_type ON improvement_proposals(proposal_type);

CREATE TABLE IF NOT EXISTS learning_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_learning_status ON learning_tasks(status);
CREATE INDEX IF NOT EXISTS idx_learning_agent ON learning_tasks(agent_id);
`

let schemaReady: Promise<void> | null = null

export function ensureSchema(db: { prepare(sql: string): { run(): Promise<unknown> } }): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const statements = SCHEMA_STATEMENTS.split(';').map(s => s.trim()).filter(Boolean)
      for (const sql of statements) {
        await db.prepare(sql).run()
      }
    })().catch((e) => {
      schemaReady = null
      throw e
    })
  }
  return schemaReady
}
