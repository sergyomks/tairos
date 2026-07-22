"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bell,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Rocket,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "@/shared/supabase";

interface Notification {
  id: string;
  type: "prp" | "task" | "healing" | "deploy";
  title: string;
  detail: string;
  timestamp: string;
  read: boolean;
}

const ICON_MAP = {
  prp: { icon: FileText, color: "text-tairos-amber" },
  task: { icon: CheckCircle2, color: "text-tairos-green" },
  healing: { icon: Wrench, color: "text-tairos-red" },
  deploy: { icon: Rocket, color: "text-tairos-cyan" },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    // Cargar eventos recientes de healing_events como notificaciones iniciales
    const loadRecent = async () => {
      const { data: healingData } = await supabase
        .from("healing_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: taskData } = await supabase
        .from("agent_tasks")
        .select("*")
        .in("status", ["completed", "failed"])
        .order("created_at", { ascending: false })
        .limit(5);

      const initial: Notification[] = [];

      if (healingData) {
        healingData.forEach((h) => {
          initial.push({
            id: `heal-${h.id}`,
            type: "healing",
            title: h.title,
            detail: (h.detail || "").slice(0, 100),
            timestamp: formatTime(h.created_at),
            read: false,
          });
        });
      }

      if (taskData) {
        taskData.forEach((t) => {
          initial.push({
            id: `task-${t.id}`,
            type: t.status === "completed" ? "task" : "healing",
            title: `Fase ${t.phase.toUpperCase()} ${t.status === "completed" ? "completada" : "fallida"}`,
            detail: t.status === "completed"
              ? "Pipeline A2A avanzó correctamente"
              : "Requiere revisión o self-healing",
            timestamp: formatTime(t.created_at),
            read: false,
          });
        });
      }

      // Ordenar por timestamp y limitar
      initial.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setNotifications(initial.slice(0, 10));
    };

    loadRecent();

    // Realtime: nuevas PRPs
    const channelPrps = supabase
      .channel("notif-prps")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "prps" },
        (payload) => {
          const prp = payload.new;
          addNotification({
            type: "prp",
            title: `Nueva PRP: ${prp.title}`,
            detail: "Esperando votación democrática (2/3)",
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "prps" },
        (payload) => {
          const prp = payload.new;
          if (prp.status === "approved") {
            addNotification({
              type: "deploy",
              title: `PRP aprobada: ${prp.title}`,
              detail: "Quórum alcanzado. Pipeline A2A iniciado.",
            });
          }
        }
      )
      .subscribe();

    // Realtime: tareas completadas o fallidas
    const channelTasks = supabase
      .channel("notif-tasks")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_tasks" },
        (payload) => {
          const task = payload.new;
          if (task.status === "completed") {
            addNotification({
              type: "task",
              title: `Fase ${task.phase.toUpperCase()} completada`,
              detail: "Pipeline A2A avanzó correctamente.",
            });
          } else if (task.status === "failed") {
            addNotification({
              type: "healing",
              title: `Fase ${task.phase.toUpperCase()} falló`,
              detail: "Self-healing intentará reparar automáticamente.",
            });
          }
        }
      )
      .subscribe();

    // Realtime: eventos de self-healing
    const channelHealing = supabase
      .channel("notif-healing")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "healing_events" },
        (payload) => {
          const event = payload.new;
          addNotification({
            type: "healing",
            title: event.title,
            detail: (event.detail || "").slice(0, 100),
          });
        }
      )
      .subscribe();

    // Cerrar dropdown al hacer clic fuera
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      supabase.removeChannel(channelPrps);
      supabase.removeChannel(channelTasks);
      supabase.removeChannel(channelHealing);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function addNotification(n: Omit<Notification, "id" | "timestamp" | "read">) {
    const newNotif: Notification = {
      ...n,
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function clearAll() {
    setNotifications([]);
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) markAllRead();
        }}
        className="relative p-2 rounded-xl text-tairos-muted hover:text-tairos-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-tairos-red text-white text-[10px] font-bold px-1 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 max-h-[480px] overflow-y-auto glass-card shadow-xl border border-tairos-border rounded-2xl z-50 animate-slide-in">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-tairos-border">
            <h3 className="text-sm font-semibold text-tairos-text">
              Notificaciones
            </h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] text-tairos-muted hover:text-tairos-red transition-colors"
                >
                  Limpiar todo
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-tairos-muted hover:text-tairos-text transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          {notifications.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Bell className="w-8 h-8 text-tairos-muted/30 mx-auto mb-2" />
              <p className="text-xs text-tairos-muted">
                Sin notificaciones por ahora
              </p>
            </div>
          ) : (
            <div className="divide-y divide-tairos-border/50">
              {notifications.map((n) => {
                const iconConfig = ICON_MAP[n.type];
                const IconComponent = iconConfig.icon;

                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-5 py-3 transition-colors ${
                      n.read
                        ? "opacity-60"
                        : "bg-tairos-accent/[0.03]"
                    }`}
                  >
                    <div className={`mt-0.5 ${iconConfig.color}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-tairos-text leading-tight">
                        {n.title}
                      </p>
                      <p className="text-[11px] text-tairos-muted mt-0.5 leading-snug">
                        {n.detail}
                      </p>
                      <p className="text-[10px] text-tairos-muted/60 mt-1">
                        {formatTime(n.timestamp)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-tairos-accent mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return "Ahora";
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHrs < 24) return `Hace ${diffHrs}h`;
    return date.toLocaleDateString("es", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}
