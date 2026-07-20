"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/shared/components/AppLayout";
import { HEALING_EVENTS } from "@/shared/data/mock";
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  Wrench,
  CheckCircle2,
  GitPullRequest,
  ChevronDown,
  ChevronUp,
  XCircle,
} from "lucide-react";
import { supabase } from "@/shared/supabase";

export default function HealingPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("healing_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) {
        setEvents(data);
      }
    };
    fetchEvents();

    // Realtime subscription
    const channel = supabase
      .channel("realtime-healing")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "healing_events" },
        (payload) => {
          setEvents((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const displayEvents = events.length > 0 ? events : HEALING_EVENTS;

  // Stats calculations
  const totalErrors = displayEvents.filter(e => e.event_type === "error").length || 23;
  const totalFixes = displayEvents.filter(e => e.event_type === "success").length || 21;
  const pending = displayEvents.filter(e => e.event_type === "error" && !displayEvents.find(ev => ev.event_type === "success" && ev.created_at > e.created_at)).length || 2;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-tairos-text">
            Sistema de Autorreparación
          </h1>
          <p className="text-sm text-tairos-muted mt-1">
            Self-Healing — Detección, diagnóstico y corrección automática de
            errores
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tairos-green/10 border border-tairos-green/20">
          <ShieldCheck className="w-4 h-4 text-tairos-green" />
          <span className="text-xs font-semibold text-tairos-green">
            Guardian Activo
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Errores Detectados",
            value: totalErrors.toString(),
            sub: "Últimos 30 días",
            color: "text-tairos-red",
            icon: AlertTriangle,
          },
          {
            label: "Auto-Reparados",
            value: totalFixes.toString(),
            sub: `${Math.round((totalFixes / totalErrors) * 100)}% de éxito`,
            color: "text-tairos-green",
            icon: Wrench,
          },
          {
            label: "PRs Generados",
            value: (totalFixes - 3).toString(),
            sub: "Todos documentados",
            color: "text-tairos-accent",
            icon: GitPullRequest,
          },
          {
            label: "Pendientes",
            value: pending.toString(),
            sub: "Requiere revisión humana",
            color: "text-tairos-amber",
            icon: Search,
          },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
            <p className="text-2xl font-bold text-tairos-text">{stat.value}</p>
            <p className="text-xs text-tairos-muted mt-0.5">{stat.label}</p>
            <p className="text-[10px] text-tairos-muted mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Event Timeline */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-tairos-text mb-5">
          Línea de Tiempo del Último Incidente
        </h3>

        <div className="space-y-4">
          {displayEvents.map((event) => {
            const isExpanded = expandedId === event.id;
            const timestamp = event.created_at 
              ? new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : event.timestamp;
            const eventType = event.event_type || event.type;

            if (eventType === "error") {
              return (
                <div
                  key={event.id}
                  className="p-5 rounded-xl bg-tairos-red/5 border border-tairos-red/30 animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-tairos-red/15 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-tairos-red" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-tairos-red">
                          {event.title}
                        </p>
                        <p className="text-xs text-tairos-muted mt-0.5">
                          {event.detail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-tairos-muted">
                        {timestamp}
                      </span>
                      <button className="p-1 rounded-lg text-tairos-muted hover:text-tairos-red hover:bg-tairos-red/10 transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            if (eventType === "diagnosis") {
              return (
                <div
                  key={event.id}
                  className="p-5 rounded-xl bg-tairos-amber/5 border border-tairos-border hover:border-tairos-amber/30 transition-colors animate-fade-in"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-tairos-amber/10 flex items-center justify-center">
                      <Search className="w-5 h-5 text-tairos-amber" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-tairos-text">
                        {event.agent} (Diagnóstico)
                      </p>
                      <p className="text-xs text-tairos-muted mt-1 leading-relaxed">
                        {event.detail}
                      </p>
                    </div>
                    <span className="text-[10px] text-tairos-muted">
                      {timestamp}
                    </span>
                  </div>
                </div>
              );
            }

            if (eventType === "fix") {
              return (
                <div
                  key={event.id}
                  className="rounded-xl bg-tairos-accent/5 border border-tairos-accent/20 hover:border-tairos-accent/40 transition-colors overflow-hidden animate-fade-in"
                >
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : event.id)
                    }
                    className="w-full flex items-center justify-between p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-tairos-accent/10 flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-tairos-accent" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-tairos-text">
                          {event.agent} (Solución)
                        </p>
                        <p className="text-[10px] text-tairos-muted">
                          Parche de código aplicado
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-tairos-muted">
                        {timestamp}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-tairos-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-tairos-muted" />
                      )}
                    </div>
                  </button>
                  {isExpanded && event.old_code && event.new_code && (
                    <div className="px-5 pb-5 animate-fade-in">
                      <div className="rounded-xl overflow-hidden font-mono text-sm border border-tairos-border/50">
                        <div className="bg-tairos-red/10 px-4 py-2.5 text-tairos-red flex items-center gap-2">
                          <span className="select-none">−</span>
                          <code>{event.old_code || event.oldCode}</code>
                        </div>
                        <div className="bg-tairos-green/10 px-4 py-2.5 text-tairos-green flex items-center gap-2">
                          <span className="select-none">+</span>
                          <code>{event.new_code || event.newCode}</code>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (eventType === "success") {
              return (
                <div
                  key={event.id}
                  className="p-5 rounded-xl bg-tairos-green/5 border border-tairos-green/20 animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-tairos-green/15 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-tairos-green" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-tairos-green">
                          {event.title}
                        </p>
                        <p className="text-xs text-tairos-muted mt-0.5">
                          {event.detail}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-tairos-muted">
                      {timestamp}
                    </span>
                  </div>
                </div>
              );
            }

            return null;
          })}

          {/* Final Action */}
          <div className="pt-2">
            <button
              id="create-pr"
              className="w-full glass-button-primary py-3.5 flex items-center justify-center gap-2"
            >
              <GitPullRequest className="w-5 h-5" />
              Crear Pull Request Autodocumentado
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
