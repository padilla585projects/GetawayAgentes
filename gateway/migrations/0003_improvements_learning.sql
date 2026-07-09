-- Migración 0003: Propuestas de mejora y sistema de aprendizaje
-- Tabla de propuestas de mejora de agentes
CREATE TABLE IF NOT EXISTS improvement_proposals (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  proposal_type TEXT NOT NULL,           -- 'feature' | 'new_agent' | 'optimization' | 'knowledge_gap' | 'integration'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',        -- 'low' | 'medium' | 'high' | 'critical'
  status TEXT DEFAULT 'pending',         -- 'pending' | 'reviewing' | 'approved' | 'rejected' | 'implemented'
  related_capabilities TEXT DEFAULT '[]', -- JSON array
  evidence TEXT DEFAULT '',              -- supporting evidence/context
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  implementation_notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_improvements_status ON improvement_proposals(status);
CREATE INDEX IF NOT EXISTS idx_improvements_agent ON improvement_proposals(agent_id);
CREATE INDEX IF NOT EXISTS idx_improvements_type ON improvement_proposals(proposal_type);

-- Tabla de tareas de aprendizaje (idle tasks)
CREATE TABLE IF NOT EXISTS learning_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  task_type TEXT NOT NULL,               -- 'knowledge_share' | 'knowledge_query' | 'self_improve' | 'capability_explore' | 'system_analysis'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',         -- 'pending' | 'in_progress' | 'completed' | 'failed'
  result TEXT DEFAULT '{}',              -- JSON resultado
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_learning_status ON learning_tasks(status);
CREATE INDEX IF NOT EXISTS idx_learning_agent ON learning_tasks(agent_id);
