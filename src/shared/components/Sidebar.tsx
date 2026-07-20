"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  GitBranch,
  ShieldCheck,
  FolderOpen,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";
import { supabase } from "@/shared/supabase";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/pipeline", label: "Pipeline A2A", icon: GitBranch },
  { href: "/healing", label: "Self-Healing", icon: ShieldCheck },
  { href: "/projects", label: "Proyectos", icon: FolderOpen },
  { href: "/settings", label: "Configuración", icon: Settings },
];

interface UserProfile {
  email: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile>({
    email: "",
    name: "Usuario",
    role: "Miembro",
    avatar: "U",
    color: "#8b5cf6",
  });

  useEffect(() => {
    const loadUserProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Extraer nombre del email (antes del @)
        const emailName =
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Usuario";
        const displayName =
          emailName.charAt(0).toUpperCase() + emailName.slice(1);

        // Buscar el rol en la tabla members
        const { data: memberData } = await supabase
          .from("members")
          .select("role")
          .eq("id", user.id)
          .single();

        const role = memberData?.role || "Miembro";

        // Asignar color según el rol
        const roleColors: Record<string, string> = {
          Backend: "#8b5cf6",
          Frontend: "#06b6d4",
          Negocio: "#10b981",
        };

        setUserProfile({
          email: user.email || "",
          name: displayName,
          role: role,
          avatar: displayName.charAt(0).toUpperCase(),
          color: roleColors[role] || "#64748b",
        });
      }
    };

    loadUserProfile();
  }, []);

  return (
    <aside className="fixed top-0 left-0 z-40 h-screen w-64 flex flex-col border-r border-tairos-border bg-tairos-surface/80 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-tairos-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-tairos-accent to-tairos-cyan shadow-neon">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-tairos-text tracking-tight">
            Tairos OS
          </h1>
          <p className="text-[10px] text-tairos-muted font-medium uppercase tracking-widest">
            Software Factory
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "sidebar-link-active" : "sidebar-link"}
            >
              <Icon className="w-4.5 h-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Runner Status */}
      <div className="px-4 py-3 mx-3 mb-3 rounded-xl bg-tairos-green/5 border border-tairos-green/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-tairos-green animate-pulse-slow" />
          <span className="text-xs font-semibold text-tairos-green">
            Búnker Online
          </span>
        </div>
        <p className="text-[10px] text-tairos-muted">
          Runner activo · Último latido hace 12s
        </p>
      </div>

      {/* User */}
      <div className="flex items-center gap-3 px-5 py-4 border-t border-tairos-border">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
          style={{
            backgroundColor: `${userProfile.color}20`,
            color: userProfile.color,
          }}
        >
          {userProfile.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-tairos-text truncate">
            {userProfile.name}
          </p>
          <p className="text-[10px] text-tairos-muted">{userProfile.role}</p>
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="p-1.5 rounded-lg text-tairos-muted hover:text-tairos-red hover:bg-tairos-red/10 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
