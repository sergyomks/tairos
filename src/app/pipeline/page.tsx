"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/shared/components/AppLayout";
import { AGENT_TASKS } from "@/shared/data/mock";
import {
  GitBranch,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowRight,
  Zap,
  Database,
  Layout,
  TestTube,
  Rocket,
  FileCode2,
} from "lucide-react";
import { supabase } from "@/shared/supabase";

const PHASES = [
  { key: "prp", label: "PRP", icon: FileCode2, color: "text-tairos-accent" },
  { key: "database", label: "Base de Datos", icon: Database, color: "text-tairos-cyan" },
  { key: "api", label: "API", icon: GitBranch, color: "text-tairos-green" },
  { key: "frontend", label: "Frontend", icon: Layout, color: "text-tairos-amber" },
  { key: "qa", label: "QA", icon: TestTube, color: "text-tairos-red" },
  { key: "deploy", label: "Deploy", icon: Rocket, color: "text-tairos-green" },
];

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-5 h-5 text-tairos-green" />;
  if (status === "in_progress") return <Loader2 className="w-5 h-5 text-tairos-cyan animate-spin" />;
  return <Clock className="w-5 h-5 text-tairos-muted" />;
}

export default function PipelinePage() {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("agent_tasks")
        .select("*")
        .order("created_at", { ascending: true });
      if (data) {
        setTasks(data);
      }
    };
    fetchTasks();

    const channel = supabase
      .channel("realtime-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_tasks" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTasks((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) =>
              prev.map((t) => (t.id === payload.new.id ? payload.new : t))
            );
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const displayTasks = tasks.length > 0 ? tasks.map(t => {
    const mapping = {
      prp: { agent: "Architect (Groq · Llama 3.3 70B)", icon: "🎨", task: "Generar propuesta de requisitos y arquitectura" },
      database: { agent: "DbWorker (Groq · Llama 3.1 8B)", icon: "🗄️", task: "Diseñar esquemas SQL y políticas RLS" },
      api: { agent: "ApiWorker (Groq · Llama 3.1 8B)", icon: "⚙️", task: "Generar endpoints API + typecheck real" },
      frontend: { agent: "UiWorker (Groq · Llama 3.1 8B)", icon: "💻", task: "Generar componentes UI + build real" },
      qa: { agent: "QaWorker (Groq · Llama 3.1 8B)", icon: "🧪", task: "Generar y ejecutar pruebas automatizadas" },
      deploy: { agent: "DeployWorker (Build + Vercel)", icon: "🚀", task: "Build de producción y despliegue" },
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
  }) : AGENT_TASKS;
  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-tairos-text">Pipeline A2A</h1>
        <p className="text-sm text-tairos-muted mt-1">
          Orquestación Architect → Workers · Modelos vía Groq (fallback: Ollama local)
        </p>
      </div>

      {/* Phase Timeline */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-sm font-semibold text-tairos-text mb-5">
          Fases del Desarrollo
        </h3>
        <div className="flex items-center justify-between">
          {PHASES.map((phase, i) => {
            const phaseTasks = tasks.filter((t) => t.phase === phase.key);
            const isDone = phaseTasks.length > 0 && phaseTasks.every((t) => t.status === "completed");
            const isActive = phaseTasks.some((t) => t.status === "in_progress");
            const isFailed = phaseTasks.some((t) => t.status === "failed");
            return (
              <div key={phase.key} className="flex items-center gap-3">
                <div
                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                    isActive
                      ? "bg-tairos-accent/10 border-tairos-accent/40 shadow-neon"
                      : isDone
                      ? "bg-tairos-green/5 border-tairos-green/20"
                      : "bg-black/[0.02] dark:bg-white/[0.02] border-tairos-border/50"
                  }`}
                >
                  <phase.icon
                    className={`w-5 h-5 ${
                      isActive
                        ? "text-tairos-accent"
                        : isDone
                        ? "text-tairos-green"
                        : "text-tairos-muted"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      isActive
                        ? "text-tairos-accent"
                        : isDone
                        ? "text-tairos-green"
                        : "text-tairos-muted"
                    }`}
                  >
                    {phase.label}
                  </span>
                  {isDone && (
                    <CheckCircle2 className="w-3 h-3 text-tairos-green" />
                  )}
                  {isActive && (
                    <Loader2 className="w-3 h-3 text-tairos-accent animate-spin" />
                  )}
                </div>
                {i < PHASES.length - 1 && (
                  <ArrowRight
                    className={`w-4 h-4 flex-shrink-0 ${
                      isDone ? "text-tairos-green/50" : "text-tairos-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Architect Delegation Diagram */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-sm font-semibold text-tairos-text mb-5">
          Delegación del Agente Architect
        </h3>
        <div className="flex items-center justify-center gap-8">
          {/* Architect */}
          <div className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-tairos-accent/5 border border-tairos-accent/20">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-tairos-accent to-tairos-cyan flex items-center justify-center shadow-neon">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <span className="text-xs font-semibold text-tairos-text">
              @tairos-architect
            </span>
            <span className="text-[10px] text-tairos-muted">
              Groq · Llama 3.3 70B
            </span>
          </div>

          {/* Arrows */}
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="w-16 h-px bg-gradient-to-r from-tairos-accent/50 to-tairos-cyan/50" />
                <ArrowRight className="w-3 h-3 text-tairos-cyan/50" />
              </div>
            ))}
          </div>

          {/* Workers */}
          <div className="flex flex-col gap-3">
            {displayTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/50"
              >
                <span className="text-xl">{task.agentIcon}</span>
                <div>
                  <p className="text-xs font-semibold text-tairos-text">
                    {task.agent}
                  </p>
                  <p className="text-[10px] text-tairos-muted">{task.task}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Details */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-tairos-text mb-5">
          Cola de Tareas Activa
        </h3>
        <div className="space-y-3">
          {displayTasks.map((task) => (
            <div
              key={task.id}
              className={`p-5 rounded-xl border transition-all ${
                task.status === "in_progress"
                  ? "bg-tairos-cyan/5 border-tairos-cyan/20 shadow-neon-cyan"
                  : task.status === "completed"
                  ? "bg-tairos-green/5 border-tairos-green/15"
                  : "bg-black/[0.02] dark:bg-white/[0.02] border-tairos-border/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{task.agentIcon}</span>
                  <div>
                    <p className="text-xs text-tairos-muted">{task.agent}</p>
                    <p className="text-sm font-semibold text-tairos-text">
                      {task.task}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status={task.status} />
                  <span
                    className={`status-badge ${
                      task.status === "completed"
                        ? "bg-tairos-green/15 text-tairos-green"
                        : task.status === "in_progress"
                        ? "bg-tairos-cyan/15 text-tairos-cyan"
                        : "bg-black/10 dark:bg-white/10 text-tairos-muted"
                    }`}
                  >
                    {task.status === "completed"
                      ? "Completado"
                      : task.status === "in_progress"
                      ? "En Progreso"
                      : "Pendiente"}
                  </span>
                </div>
              </div>
              {task.status === "in_progress" && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-tairos-muted">Progreso</span>
                    <span className="text-tairos-cyan font-semibold">
                      {task.progress}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-tairos-cyan to-tairos-accent transition-all duration-1000"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
