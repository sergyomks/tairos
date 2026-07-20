"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/shared/components/AppLayout";
import { CHAT_MESSAGES, PROJECTS, AGENT_TASKS, RUNNER_STATUS } from "@/shared/data/mock";
import {
  MessageSquare,
  GitBranch,
  FolderOpen,
  Server,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/shared/supabase";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    deployed: "bg-tairos-green/15 text-tairos-green",
    developing: "bg-tairos-cyan/15 text-tairos-cyan",
    testing: "bg-tairos-amber/15 text-tairos-amber",
    failed: "bg-tairos-red/15 text-tairos-red",
    completed: "bg-tairos-green/15 text-tairos-green",
    in_progress: "bg-tairos-cyan/15 text-tairos-cyan",
    pending: "bg-black/10 dark:bg-white/10 text-tairos-muted",
  };
  const labels: Record<string, string> = {
    deployed: "Activo",
    developing: "Desarrollando",
    testing: "Testeando",
    failed: "Fallido",
    completed: "Completado",
    in_progress: "En Progreso",
    pending: "Pendiente",
  };
  return (
    <span className={`status-badge ${styles[status] || ""}`}>
      {labels[status] || status}
    </span>
  );
}

const getSenderMetadata = (name: string, senderId: string | null) => {
  const lowerName = name.toLowerCase();
  if (!senderId || lowerName.includes("agent") || lowerName.includes("tairos") || lowerName.includes("system")) {
    return {
      avatar: "T",
      role: "System Agent",
      color: "#8b5cf6",
      isAgent: true
    };
  }
  if (lowerName.includes("sergio")) {
    return { avatar: "S", role: "Backend", color: "#8b5cf6", isAgent: false };
  }
  if (lowerName.includes("carlos")) {
    return { avatar: "C", role: "Frontend", color: "#06b6d4", isAgent: false };
  }
  if (lowerName.includes("ana")) {
    return { avatar: "A", role: "Negocio", color: "#10b981", isAgent: false };
  }
  return {
    avatar: name[0]?.toUpperCase() || "U",
    role: "Miembro",
    color: "#64748b",
    isAgent: false
  };
};

export default function DashboardPage() {
  const [dbData, setDbData] = useState({
    projects: [] as any[],
    tasks: [] as any[],
    messages: [] as any[],
    runner: null as any
  });

  useEffect(() => {
    const fetchData = async () => {
      const [resProjects, resTasks, resMessages, resRunner] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("agent_tasks").select("*").order("created_at", { ascending: true }),
        supabase.from("chat_messages").select("*").order("created_at", { ascending: true }),
        supabase.from("runner_status").select("*").eq("id", "default").maybeSingle()
      ]);

      setDbData({
        projects: resProjects.data || [],
        tasks: resTasks.data || [],
        messages: resMessages.data || [],
        runner: resRunner.data || null
      });
    };
    fetchData();

    // Subscribe to realtime messages, tasks and runner status
    const channelMessages = supabase
      .channel("dashboard-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
        setDbData(prev => ({ ...prev, messages: [...prev.messages, p.new] }));
      })
      .subscribe();

    const channelTasks = supabase
      .channel("dashboard-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_tasks" }, (p) => {
        if (p.eventType === "INSERT") {
          setDbData(prev => ({ ...prev, tasks: [...prev.tasks, p.new] }));
        } else if (p.eventType === "UPDATE") {
          setDbData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === p.new.id ? p.new : t) }));
        }
      })
      .subscribe();

    const channelRunner = supabase
      .channel("dashboard-runner")
      .on("postgres_changes", { event: "*", schema: "public", table: "runner_status", filter: "id=eq.default" }, (p) => {
        setDbData(prev => ({ ...prev, runner: p.new }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelMessages);
      supabase.removeChannel(channelTasks);
      supabase.removeChannel(channelRunner);
    };
  }, []);

  const displayMessages = dbData.messages.length > 0 ? dbData.messages.slice(-3).map(msg => {
    const meta = getSenderMetadata(msg.sender_name, msg.sender_id);
    const formattedTime = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      id: msg.id,
      sender: msg.sender_name,
      time: formattedTime,
      content: msg.content,
      avatar: meta.avatar,
      color: meta.color
    };
  }) : CHAT_MESSAGES.slice(-3);

  const displayTasks = dbData.tasks.length > 0 ? dbData.tasks.slice(0, 3).map(t => {
    const mapping = {
      prp: { agent: "Architect (Claude 3.5)", icon: "🎨", task: "Generar propuesta de requisitos y arquitectura" },
      database: { agent: "DbWorker (Qwen-Coder)", icon: "🗄️", task: "Configurar y estructurar tablas de base de datos" },
      api: { agent: "ApiWorker (Qwen-Coder)", icon: "⚙️", task: "Desarrollar controladores y endpoints API" },
      frontend: { agent: "UiWorker (DeepSeek-Coder)", icon: "💻", task: "Diseñar y compilar componentes de interfaz" },
      qa: { agent: "QaWorker (Llama-3 Local)", icon: "🧪", task: "Generar y ejecutar pruebas automatizadas" },
      deploy: { agent: "DeployWorker (Docker)", icon: "🚀", task: "Crear contenedor y realizar despliegue" },
    }[t.phase as "prp" | "database" | "api" | "frontend" | "qa" | "deploy"] || { agent: "Worker Agent", icon: "🤖", task: "Ejecutar tarea asignada" };

    const logsArray = Array.isArray(t.logs) ? t.logs : [];
    const progress = t.status === "completed" ? 100 : t.status === "pending" ? 0 : Math.min(20 + logsArray.length * 20, 95);

    return {
      id: t.id,
      agent: mapping.agent,
      agentIcon: mapping.icon,
      task: mapping.task,
      phase: t.phase,
      status: t.status,
      progress
    };
  }) : AGENT_TASKS.slice(0, 3);

  const displayProjects = dbData.projects.length > 0 ? dbData.projects.map(p => ({
    id: p.id,
    name: p.name,
    type: p.outcomes_data?.type || "SaaS de la Fábrica",
    status: p.status,
    uptime: p.outcomes_data?.uptime || "—",
    users: p.outcomes_data?.users || 0,
    growth: p.outcomes_data?.growth || "—",
    revenue: p.outcomes_data?.revenue || "—",
    conversionRate: p.outcomes_data?.conversionRate || "—",
    repository_url: p.repository_url,
  })) : PROJECTS;

  const activeProjects = displayProjects.filter((p) => p.status === "deployed");

  // Stats
  const activeProjectsCount = displayProjects.filter(p => p.status === "deployed").length || 2;
  const tasksCountToday = dbData.tasks.length || 12;
  const messagesCount = dbData.messages.length || 48;

  // Dynamic Runner State
  const runnerState = dbData.runner || {
    is_online: true,
    cpu: RUNNER_STATUS.cpu,
    ram: RUNNER_STATUS.ram,
    tasks_processed: RUNNER_STATUS.tasksProcessed,
    uptime: RUNNER_STATUS.uptime,
    last_heartbeat: new Date().toISOString()
  };

  const isRunnerOnline = dbData.runner 
    ? (new Date().getTime() - new Date(runnerState.last_heartbeat).getTime() < 30000)
    : true; // Default to online if not loaded yet

  const cpuPercent = parseInt(runnerState.cpu) || 23;
  const ramString = runnerState.ram || RUNNER_STATUS.ram;
  // Estimate RAM percentage: e.g. "1.2 GB / 8 GB" -> 15%
  let ramPercent = 15;
  try {
    const parts = ramString.split("/");
    if (parts.length === 2) {
      const used = parseFloat(parts[0]);
      const total = parseFloat(parts[1]);
      if (used && total) ramPercent = Math.round((used / total) * 100);
    }
  } catch(e) {}

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-tairos-text">Dashboard</h1>
        <p className="text-sm text-tairos-muted mt-1">
          Vista general de la fábrica de software Tairos OS
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Proyectos Activos", value: activeProjectsCount.toString(), icon: FolderOpen, color: "text-tairos-accent" },
          { label: "Tareas Totales", value: tasksCountToday.toString(), icon: GitBranch, color: "text-tairos-cyan" },
          { label: "Mensajes Chat", value: messagesCount.toString(), icon: MessageSquare, color: "text-tairos-green" },
          { label: "Uptime Búnker", value: runnerState.uptime, icon: Server, color: "text-tairos-amber" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <ArrowUpRight className="w-4 h-4 text-tairos-muted" />
            </div>
            <p className="text-2xl font-bold text-tairos-text">{stat.value}</p>
            <p className="text-xs text-tairos-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Chat Preview — Spans 5 cols */}
        <div className="col-span-5 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-tairos-accent" />
              <h3 className="text-sm font-semibold text-tairos-text">Chat Reciente</h3>
            </div>
            <Link href="/chat" className="text-xs text-tairos-accent hover:underline flex items-center gap-1">
              Ver todo <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {displayMessages.map((msg) => (
              <div key={msg.id} className="flex gap-3 animate-fade-in">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    backgroundColor: msg.color + "20",
                    color: msg.color,
                  }}
                >
                  {msg.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-tairos-text">
                      {msg.sender}
                    </span>
                    <span className="text-[9px] text-tairos-muted">
                      {msg.time}
                    </span>
                  </div>
                  <p className="text-xs text-tairos-muted mt-0.5 line-clamp-2">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline A2A — Spans 7 cols */}
        <div className="col-span-7 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-tairos-cyan" />
              <h3 className="text-sm font-semibold text-tairos-text">
                Pipeline A2A — Actividad
              </h3>
            </div>
            <Link href="/pipeline" className="text-xs text-tairos-cyan hover:underline flex items-center gap-1">
              Ver pipeline <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {displayTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/50"
              >
                <span className="text-xl">{task.agentIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-tairos-muted">{task.agent}</p>
                  <p className="text-sm font-medium text-tairos-text truncate">
                    {task.task}
                  </p>
                  {task.status === "in_progress" && (
                    <div className="mt-2 h-1.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-tairos-cyan to-tairos-accent transition-all duration-1000"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {task.status === "completed" && (
                    <CheckCircle2 className="w-4 h-4 text-tairos-green" />
                  )}
                  {task.status === "in_progress" && (
                    <Loader2 className="w-4 h-4 text-tairos-cyan animate-spin" />
                  )}
                  {task.status === "pending" && (
                    <Clock className="w-4 h-4 text-tairos-muted" />
                  )}
                  <StatusBadge status={task.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio — Spans 8 cols */}
        <div className="col-span-8 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-tairos-green" />
              <h3 className="text-sm font-semibold text-tairos-text">
                Portafolio de Productos
              </h3>
            </div>
            <Link href="/projects" className="text-xs text-tairos-green hover:underline flex items-center gap-1">
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {activeProjects.slice(0, 2).map((project) => (
              <div
                key={project.id}
                className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/50 hover:border-tairos-green/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-tairos-text">
                      {project.name}
                    </h4>
                    <p className="text-[10px] text-tairos-muted">
                      {project.type}
                    </p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-tairos-muted">Usuarios</p>
                    <p className="text-sm font-bold text-tairos-text flex items-center gap-1">
                      {project.users > 0 ? project.users.toLocaleString() : "—"}
                      {project.growth !== "—" && (
                        <span className="text-[10px] text-tairos-green font-medium">
                          {project.growth}
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-tairos-muted">Uptime</p>
                    <p className="text-sm font-bold text-tairos-text">
                      {project.uptime}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-tairos-muted">Conversión</p>
                    <p className="text-sm font-bold text-tairos-text">
                      {project.conversionRate}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-tairos-muted">
                      Revenue Semanal
                    </p>
                    <p className="text-sm font-bold text-tairos-green">
                      {project.revenue}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Runner Status — Spans 4 cols */}
        <div className="col-span-4 glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-tairos-amber" />
            <h3 className="text-sm font-semibold text-tairos-text">Búnker Local</h3>
          </div>
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              isRunnerOnline 
                ? "bg-tairos-green/5 border-tairos-green/15" 
                : "bg-tairos-red/5 border-tairos-red/15"
            }`}>
              <Activity className={`w-5 h-5 ${isRunnerOnline ? "text-tairos-green" : "text-tairos-red"}`} />
              <div>
                <p className={`text-xs font-semibold ${isRunnerOnline ? "text-tairos-green" : "text-tairos-red"}`}>
                  {isRunnerOnline ? "Online" : "Offline"}
                </p>
                <p className="text-[10px] text-tairos-muted">
                  {isRunnerOnline ? "Corriendo en segundo plano" : "El búnker no reporta latidos"}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-tairos-muted flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> CPU
                  </span>
                  <span className="text-tairos-text font-medium">
                    {runnerState.cpu}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      cpuPercent > 80 ? "bg-tairos-red" : cpuPercent > 50 ? "bg-tairos-amber" : "bg-tairos-green"
                    }`}
                    style={{ width: `${cpuPercent}%` }} 
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-tairos-muted flex items-center gap-1">
                    <HardDrive className="w-3 h-3" /> RAM
                  </span>
                  <span className="text-tairos-text font-medium">
                    {ramString}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-tairos-cyan transition-all duration-1000"
                    style={{ width: `${ramPercent}%` }} 
                  />
                </div>
              </div>
            </div>
            <div className="neon-divider" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-tairos-muted">
                  Tareas Procesadas
                </p>
                <p className="text-lg font-bold text-tairos-text">
                  {runnerState.tasks_processed}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-tairos-muted">Uptime</p>
                <p className="text-lg font-bold text-tairos-text">
                  {runnerState.uptime}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
