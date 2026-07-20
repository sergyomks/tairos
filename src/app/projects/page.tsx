"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/AppLayout";
import { PROJECTS } from "@/shared/data/mock";
import {
  FolderOpen,
  ExternalLink,
  GitBranch,
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  Plus,
} from "lucide-react";
import { supabase } from "@/shared/supabase";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    deployed: "bg-tairos-green/15 text-tairos-green border-tairos-green/30",
    developing: "bg-tairos-cyan/15 text-tairos-cyan border-tairos-cyan/30",
    testing: "bg-tairos-amber/15 text-tairos-amber border-tairos-amber/30",
    failed: "bg-tairos-red/15 text-tairos-red border-tairos-red/30",
    planning: "bg-black/10 dark:bg-white/10 text-tairos-muted border-tairos-border",
  };
  const labels: Record<string, string> = {
    deployed: "● Activo",
    developing: "◉ Desarrollando",
    testing: "◎ Testeando",
    failed: "✕ Fallido",
    planning: "○ Planeando",
  };
  return (
    <span className={`status-badge border ${styles[status] || ""}`}>
      {labels[status] || status}
    </span>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [dbProjects, setDbProjects] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [projectType, setProjectType] = useState<"new" | "existing" | null>(null);
  const [newProject, setNewProject] = useState({
    name: "",
    type: "SaaS",
    repository_url: "",
    agent_permissions: {
      monitor_metrics: true,
      self_healing: true,
      suggest_improvements: true,
      auto_changes: false,
    },
  });

  useEffect(() => {
    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) {
        setDbProjects(data);
      }
    };
    fetchProjects();

    // Realtime subscription
    const channel = supabase
      .channel("realtime-projects")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "projects" },
        (payload) => {
          setDbProjects((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim() || !projectType) return;

    const projectData: any = {
      name: newProject.name,
      repository_url: newProject.repository_url || null,
      status: projectType === "new" ? "planning" : "deployed",
      outcomes_data: {
        type: newProject.type,
        is_imported: projectType === "existing",
        agent_permissions: newProject.agent_permissions,
      },
    };

    const { error } = await supabase.from("projects").insert(projectData);

    if (!error) {
      setShowModal(false);
      setProjectType(null);
      setNewProject({
        name: "",
        type: "SaaS",
        repository_url: "",
        agent_permissions: {
          monitor_metrics: true,
          self_healing: true,
          suggest_improvements: true,
          auto_changes: false,
        },
      });
    }
  };

  const displayProjects = dbProjects.length > 0 ? dbProjects.map(p => ({
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

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-tairos-text">Proyectos</h1>
          <p className="text-sm text-tairos-muted mt-1">
            Portafolio de productos SaaS generados por la fábrica
          </p>
        </div>
        <button id="new-project" onClick={() => setShowModal(true)} className="glass-button-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Proyecto
        </button>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-3 gap-5">
        {displayProjects.map((project) => (
          <div
            key={project.id}
            className={`glass-card p-6 transition-all ${
              project.status === "deployed"
                ? "hover:border-tairos-green/30"
                : project.status === "developing"
                ? "hover:border-tairos-cyan/30"
                : "hover:border-tairos-border-hover"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                    project.status === "deployed"
                      ? "bg-tairos-green/10 text-tairos-green"
                      : project.status === "developing"
                      ? "bg-tairos-cyan/10 text-tairos-cyan"
                      : "bg-tairos-accent/10 text-tairos-accent"
                  }`}
                >
                  {project.name[0]}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-tairos-text">
                    {project.name}
                  </h3>
                  <p className="text-[10px] text-tairos-muted">{project.type}</p>
                </div>
              </div>
              <StatusBadge status={project.status} />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/30">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3 h-3 text-tairos-muted" />
                  <span className="text-[10px] text-tairos-muted">
                    Usuarios Activos
                  </span>
                </div>
                <p className="text-lg font-bold text-tairos-text">
                  {project.users > 0
                    ? project.users.toLocaleString()
                    : "—"}
                </p>
                {project.growth !== "—" && (
                  <span className="text-[10px] font-medium text-tairos-green">
                    {project.growth}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/30">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3 h-3 text-tairos-muted" />
                  <span className="text-[10px] text-tairos-muted">Uptime</span>
                </div>
                <p className="text-lg font-bold text-tairos-text">{project.uptime}</p>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/30">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3 h-3 text-tairos-muted" />
                  <span className="text-[10px] text-tairos-muted">
                    Conversión
                  </span>
                </div>
                <p className="text-lg font-bold text-tairos-text">
                  {project.conversionRate}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/30">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3 h-3 text-tairos-muted" />
                  <span className="text-[10px] text-tairos-muted">
                    Revenue Semanal
                  </span>
                </div>
                <p
                  className={`text-lg font-bold ${
                    project.revenue !== "—"
                      ? "text-tairos-green"
                      : "text-tairos-muted"
                  }`}
                >
                  {project.revenue}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button className="flex-1 glass-button flex items-center justify-center gap-1.5 text-xs">
                <GitBranch className="w-3.5 h-3.5" /> Repositorio
              </button>
              {project.status === "deployed" && (
                <button className="flex-1 glass-button flex items-center justify-center gap-1.5 text-xs">
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir App
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nuevo Proyecto */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card p-6 w-full max-w-lg animate-slide-in">
            {!projectType ? (
              /* Paso 1: Seleccionar tipo de proyecto */
              <>
                <h3 className="text-lg font-bold text-tairos-text mb-1">
                  Crear o Importar Proyecto
                </h3>
                <p className="text-xs text-tairos-muted mb-6">
                  ¿Qué quieres hacer?
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      router.push("/chat");
                    }}
                    className="w-full p-5 rounded-xl bg-tairos-accent/5 border border-tairos-accent/20 hover:border-tairos-accent/40 hover:bg-tairos-accent/10 transition-all text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-tairos-accent/15 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
                        🤖
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-tairos-text mb-1">
                          Crear proyecto nuevo con IA
                        </p>
                        <p className="text-xs text-tairos-muted leading-relaxed">
                          Ir al chat para planificar con el Architect. Los
                          agentes construirán todo desde cero
                        </p>
                      </div>
                      <div className="text-tairos-accent opacity-0 group-hover:opacity-100 transition-opacity">
                        →
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setProjectType("existing")}
                    className="w-full p-5 rounded-xl bg-tairos-cyan/5 border border-tairos-cyan/20 hover:border-tairos-cyan/40 hover:bg-tairos-cyan/10 transition-all text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-tairos-cyan/15 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
                        📂
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-tairos-text mb-1">
                          Importar proyecto existente
                        </p>
                        <p className="text-xs text-tairos-muted leading-relaxed">
                          Conecta tu repositorio. Los agentes lo monitorearan,
                          mejorarán y aplicarán self-healing
                        </p>
                      </div>
                      <div className="text-tairos-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                        →
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full mt-4 glass-button"
                >
                  Cancelar
                </button>
              </>
            ) : (
              /* Paso 2: Formulario para Importar Proyecto Existente */
              <form onSubmit={handleCreateProject}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-tairos-text">
                      Importar Proyecto Existente
                    </h3>
                    <p className="text-xs text-tairos-muted mt-1">
                      Conecta tu repositorio para monitoreo y mejoras
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProjectType(null)}
                    className="text-xs text-tairos-muted hover:text-tairos-text"
                  >
                    ← Atrás
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-tairos-muted mb-1.5 uppercase tracking-wider">
                      Nombre del Proyecto *
                    </label>
                    <input
                      type="text"
                      value={newProject.name}
                      onChange={(e) =>
                        setNewProject({ ...newProject, name: e.target.value })
                      }
                      placeholder="Ej: InvenTrack, TaskFlow..."
                      className="glass-input"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-tairos-muted mb-1.5 uppercase tracking-wider">
                      URL del Repositorio *
                    </label>
                    <input
                      type="url"
                      value={newProject.repository_url}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          repository_url: e.target.value,
                        })
                      }
                      placeholder="https://github.com/usuario/proyecto"
                      className="glass-input font-mono text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-tairos-muted mb-1.5 uppercase tracking-wider">
                      Tipo de Producto
                    </label>
                    <select
                      value={newProject.type}
                      onChange={(e) =>
                        setNewProject({ ...newProject, type: e.target.value })
                      }
                      className="glass-input"
                    >
                      <option value="SaaS">SaaS</option>
                      <option value="Marketplace">Marketplace</option>
                      <option value="API Platform">API Platform</option>
                      <option value="E-commerce">E-commerce</option>
                      <option value="Dashboard">Dashboard</option>
                      <option value="Mobile App">Mobile App</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-tairos-muted mb-2 uppercase tracking-wider">
                      Permisos para Agentes
                    </label>
                    <div className="space-y-2">
                      {[
                        {
                          key: "monitor_metrics",
                          label: "Monitorear métricas en tiempo real",
                          desc: "Usuarios, uptime, errores",
                        },
                        {
                          key: "self_healing",
                          label: "Self-healing automático",
                          desc: "Corregir errores sin intervención",
                        },
                        {
                          key: "suggest_improvements",
                          label: "Sugerir mejoras de código",
                          desc: "Analizar y proponer optimizaciones",
                        },
                        {
                          key: "auto_changes",
                          label: "Hacer cambios sin aprobación",
                          desc: "⚠️ Aplicar cambios directamente (no recomendado)",
                        },
                      ].map((permission) => (
                        <label
                          key={permission.key}
                          className="flex items-start gap-3 p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/30 hover:border-tairos-border cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={
                              newProject.agent_permissions[
                                permission.key as keyof typeof newProject.agent_permissions
                              ]
                            }
                            onChange={(e) =>
                              setNewProject({
                                ...newProject,
                                agent_permissions: {
                                  ...newProject.agent_permissions,
                                  [permission.key]: e.target.checked,
                                },
                              })
                            }
                            className="mt-0.5 w-4 h-4 rounded border-tairos-border accent-tairos-accent"
                          />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-tairos-text">
                              {permission.label}
                            </p>
                            <p className="text-[10px] text-tairos-muted mt-0.5">
                              {permission.desc}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 mt-4 border-t border-tairos-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setProjectType(null);
                    }}
                    className="flex-1 glass-button"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 glass-button-primary">
                    📂 Importar Proyecto
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
