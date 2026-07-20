/**
 * Tipos TypeScript correspondientes a las tablas de Supabase
 * Basados en: supabase_schema.sql
 */

// Tabla: public.members
export interface Member {
  id: string;
  email: string;
  role: "Negocio" | "Frontend" | "Backend";
  created_at: string;
}

// Tabla: public.projects
export interface Project {
  id: string;
  name: string;
  repository_url: string | null;
  status: "planning" | "developing" | "testing" | "deployed" | "failed";
  outcomes_data: {
    users?: number;
    growth?: string;
    revenue?: string;
    uptime?: string;
    conversionRate?: string;
    type?: string;
  };
  created_at: string;
}

// Tabla: public.chat_messages
export interface ChatMessage {
  id: string;
  project_id: string | null;
  sender_id: string | null;
  sender_name: string;
  content: string;
  created_at: string;
}

// Tabla: public.agent_tasks
export interface AgentTask {
  id: string;
  project_id: string;
  phase: "prp" | "database" | "api" | "frontend" | "qa" | "deploy";
  status: "pending" | "in_progress" | "completed" | "failed";
  logs: Array<{ message: string; timestamp: string }>;
  created_at: string;
}

// Tabla: public.runner_heartbeat (nueva — estado del búnker)
export interface RunnerHeartbeat {
  id: string;
  hostname: string;
  cpu: string;
  ram: string;
  tasks_processed: number;
  uptime: string;
  updated_at: string;
}
