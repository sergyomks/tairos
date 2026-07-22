"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/shared/components/AppLayout";
import { TEAM_MEMBERS } from "@/shared/data/mock";
import {
  Settings,
  User,
  Server,
  Key,
  Brain,
  Shield,
  Save,
  Trash2,
  Plus,
} from "lucide-react";
import { supabase } from "@/shared/supabase";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("team");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      const { data } = await supabase
        .from("members")
        .select("*")
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setTeamMembers(data);
      } else {
        setTeamMembers(TEAM_MEMBERS);
      }
    };
    fetchTeamMembers();
  }, []);

  const tabs = [
    { key: "team", label: "Equipo", icon: User },
    { key: "runner", label: "Búnker Local", icon: Server },
    { key: "api", label: "Claves API", icon: Key },
    { key: "agents", label: "Agentes IA", icon: Brain },
    { key: "security", label: "Seguridad", icon: Shield },
  ];

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-tairos-text">Configuración</h1>
        <p className="text-sm text-tairos-muted mt-1">
          Ajustes del equipo, conexiones y agentes de la plataforma
        </p>
      </div>

      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-56 flex-shrink-0 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={
                  isActive ? "sidebar-link-active w-full" : "sidebar-link w-full"
                }
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 glass-card p-6">
          {activeTab === "team" && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold text-tairos-text">
                    Miembros del Equipo
                  </h3>
                  <p className="text-xs text-tairos-muted mt-1">
                    Gestiona los 3 ingenieros de dirección de intenciones
                  </p>
                </div>
                <button className="glass-button flex items-center gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Invitar
                </button>
              </div>

              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{
                          backgroundColor: (member.color || "#8b5cf6") + "20",
                          color: member.color || "#8b5cf6",
                        }}
                      >
                        {member.avatar || member.email?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-tairos-text">
                          {member.name || member.email?.split("@")[0] || "Usuario"}
                        </p>
                        <p className="text-xs text-tairos-muted">
                          {member.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="status-badge bg-tairos-green/15 text-tairos-green">
                        Activo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "runner" && (
            <div className="animate-fade-in">
              <h3 className="text-base font-semibold text-tairos-text mb-1">
                Configuración del Búnker Local
              </h3>
              <p className="text-xs text-tairos-muted mb-6">
                Conexión y ajustes del runner local (PM2)
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-tairos-muted mb-1.5 uppercase tracking-wider">
                    Directorio de Trabajo
                  </label>
                  <input
                    className="glass-input font-mono text-xs"
                    defaultValue="/home/sergyo/Documentos/tairos os/tairos-os"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tairos-muted mb-1.5 uppercase tracking-wider">
                    Intervalo de Heartbeat (segundos)
                  </label>
                  <input
                    className="glass-input"
                    type="number"
                    defaultValue={30}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tairos-muted mb-1.5 uppercase tracking-wider">
                    Modo de Ejecución
                  </label>
                  <select className="glass-input">
                    <option>Directa (Node.js + PM2)</option>
                    <option>Aislada (Docker Container)</option>
                  </select>
                </div>
              </div>

              <button className="glass-button-primary flex items-center gap-2 mt-6">
                <Save className="w-4 h-4" /> Guardar Configuración
              </button>
            </div>
          )}

          {activeTab === "api" && (
            <div className="animate-fade-in">
              <h3 className="text-base font-semibold text-tairos-text mb-1">
                Claves de API
              </h3>
              <p className="text-xs text-tairos-muted mb-6">
                Credenciales de servicios externos conectados
              </p>

              <div className="space-y-4">
                {[
                  {
                    label: "Supabase URL",
                    value: "https://••••••••.supabase.co",
                    env: "NEXT_PUBLIC_SUPABASE_URL",
                  },
                  {
                    label: "Supabase Anon Key",
                    value: "eyJhbGci••••••••••••",
                    env: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
                  },
                  {
                    label: "OpenRouter API Key",
                    value: "sk-or-v1-••••••••",
                    env: "OPENROUTER_API_KEY",
                  },
                ].map((key) => (
                  <div key={key.env}>
                    <label className="block text-xs font-medium text-tairos-muted mb-1.5 uppercase tracking-wider">
                      {key.label}
                    </label>
                    <div className="flex gap-2">
                      <input
                        className="glass-input flex-1 font-mono text-xs"
                        type="password"
                        defaultValue={key.value}
                      />
                      <button className="glass-button text-xs">Mostrar</button>
                    </div>
                    <p className="text-[10px] text-tairos-muted mt-1 font-mono">
                      {key.env}
                    </p>
                  </div>
                ))}
              </div>

              <button className="glass-button-primary flex items-center gap-2 mt-6">
                <Save className="w-4 h-4" /> Guardar Claves
              </button>
            </div>
          )}

          {activeTab === "agents" && (
            <div className="animate-fade-in">
              <h3 className="text-base font-semibold text-tairos-text mb-1">
                Configuración de Agentes IA
              </h3>
              <p className="text-xs text-tairos-muted mb-6">
                Modelos asignados a cada rol del pipeline A2A
              </p>

              <div className="space-y-4">
                {[
                  {
                    role: "Architect (Razonador)",
                    model: "Groq · Llama 3.3 70B Versatile",
                    cost: "$0.00 — Free Tier Groq",
                  },
                  {
                    role: "Worker (Codificador)",
                    model: "Groq · Llama 3.1 8B Instant",
                    cost: "$0.00 — Free Tier Groq",
                  },
                  {
                    role: "Healer (Auto-reparación)",
                    model: "Groq · Llama 3.1 8B Instant",
                    cost: "$0.00 — Free Tier Groq",
                  },
                  {
                    role: "Fallback (Local)",
                    model: "Ollama · Qwen 2.5 Coder 7B",
                    cost: "$0.00 — Local",
                  },
                ].map((agent) => (
                  <div
                    key={agent.role}
                    className="flex items-center justify-between p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-tairos-text">
                        {agent.role}
                      </p>
                      <p className="text-xs text-tairos-muted mt-0.5">
                        {agent.model}
                      </p>
                    </div>
                    <span className="text-xs text-tairos-cyan font-mono">
                      {agent.cost}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="animate-fade-in">
              <h3 className="text-base font-semibold text-tairos-text mb-1">
                Seguridad y Aprobación
              </h3>
              <p className="text-xs text-tairos-muted mb-6">
                Configuración del voto democrático y permisos
              </p>

              <div className="space-y-5">
                <div className="flex items-center justify-between p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/50">
                  <div>
                    <p className="text-sm font-semibold text-tairos-text">
                      Votos mínimos para aprobar PRP
                    </p>
                    <p className="text-xs text-tairos-muted mt-0.5">
                      Cantidad de humanos que deben firmar antes de codificar
                    </p>
                  </div>
                  <select className="glass-input w-20 text-center">
                    <option>2</option>
                    <option>3</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/50">
                  <div>
                    <p className="text-sm font-semibold text-tairos-text">
                      RLS habilitado en Supabase
                    </p>
                    <p className="text-xs text-tairos-muted mt-0.5">
                      Row Level Security activado por defecto
                    </p>
                  </div>
                  <span className="status-badge bg-tairos-green/15 text-tairos-green">
                    Activado
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/50">
                  <div>
                    <p className="text-sm font-semibold text-tairos-text">
                      Código en Búnker Local
                    </p>
                    <p className="text-xs text-tairos-muted mt-0.5">
                      Repositorios Git almacenados exclusivamente en servidor
                      local
                    </p>
                  </div>
                  <span className="status-badge bg-tairos-green/15 text-tairos-green">
                    Activado
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
